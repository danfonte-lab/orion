const fs = require('fs');
const path = require('path');
const {
  withAppDelegate,
  withXcodeProject,
  withDangerousMod,
  createRunOncePlugin,
} = require('@expo/config-plugins');
const { version: appVersion } = require('../package.json');

function patchIosAppDelegate(contents) {
  let next = contents;

  // Keep access level consistent with ExpoAppDelegate internal visibility.
  next = next.replace(/^import Expo$/m, 'internal import Expo');

  // RN/Expo template mismatch can generate this invalid call.
  next = next.replace(/^\s*bindReactNativeFactory\(factory\)\s*\n/m, '');

  // Avoid public access level conflicts when superclass is internal.
  next = next.replace(/^public class AppDelegate/m, 'class AppDelegate');
  next = next.replace(/^\s*public override func /gm, '  override func ');

  return next;
}

function patchAndroidMainApplication(contents) {
  let next = contents;

  next = next.replace(
    'import expo.modules.ReactNativeHostWrapper',
    'import expo.modules.ExpoReactHostFactory'
  );

  next = next.replace(
    /override val reactNativeHost:[\s\S]*?\n\s*\)\n\n\s*override val reactHost: ReactHost\n\s*get\(\) = ReactNativeHostWrapper\.createReactHost\(applicationContext, reactNativeHost\)/m,
    `override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
            }

        override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
      }

  override val reactHost: ReactHost
    get() = ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList = PackageList(reactNativeHost).packages,
      jsMainModulePath = ".expo/.virtual-metro-entry",
      jsBundleAssetPath = "index.android.bundle",
      jsBundleFilePath = null,
      jsRuntimeFactory = null,
      useDevSupport = BuildConfig.DEBUG
    )`
  );

  return next;
}

function patchAndroidAppBuildGradle(contents) {
  let next = contents;

  next = next.replace(
    /hermesCommand\s*=\s*new File\(\["node", "--print", "require\.resolve\('react-native\/package\.json'\)"\]\.execute\(null, rootDir\)\.text\.trim\(\)\)\.getParentFile\(\)\.getAbsolutePath\(\) \+ "\/sdks\/hermesc\/%OS-BIN%\/hermesc"/,
    `hermesCommand = new File(["node", "--print", "require.resolve('hermes-compiler/package.json')"].execute(null, rootDir).text.trim()).getParentFile().getAbsolutePath() + "/hermesc/%OS-BIN%/hermesc"`
  );

  if (!next.includes("project.ext.sentryCli = [")) {
    next = next.replace(
      "def jscFlavor = 'io.github.react-native-community:jsc-android:2026004.+'",
      `def jscFlavor = 'io.github.react-native-community:jsc-android:2026004.+'

project.ext.sentryCli = [
    autoUpload: false
]`
    );
  }

  if (!next.includes('tasks.matching { it.name.contains("_SentryUpload_") }')) {
    next = `${next.trimEnd()}

afterEvaluate {
    tasks.matching { it.name.contains("_SentryUpload_") }.configureEach {
        enabled = false
    }
}
`;
  }

  if (!next.includes('signingConfigs.release')) {
    next = next.replace(
      /signingConfigs \{\n\s*debug \{[\s\S]*?\n\s*\}/m,
      (match) => `${match}
        release {
            storeFile rootProject.file(findProperty('MYAPP_UPLOAD_STORE_FILE') ?: '../ubiquity.keystore')
            storePassword System.getenv('MYAPP_UPLOAD_STORE_PASSWORD') ?: (findProperty('MYAPP_UPLOAD_STORE_PASSWORD') ?: '')
            keyAlias findProperty('MYAPP_UPLOAD_KEY_ALIAS') ?: ''
            keyPassword System.getenv('MYAPP_UPLOAD_KEY_PASSWORD') ?: (findProperty('MYAPP_UPLOAD_KEY_PASSWORD') ?: '')
        }`
    );
  }

  next = next.replace(
    /release \{([\s\S]*?)signingConfig signingConfigs\.debug/m,
    'release {$1signingConfig signingConfigs.release'
  );
  next = next.replace(
    /release \{([\s\S]*?)signingConfig signingConfigs\.debug/m,
    'release {$1signingConfig signingConfigs.release'
  );
  next = next.replace(
    /debug \{([\s\S]*?)signingConfig signingConfigs\.release/m,
    'debug {$1signingConfig signingConfigs.debug'
  );

  return next;
}

function patchAndroidGradleProperties(contents) {
  let next = contents;

  const entries = [
    'MYAPP_UPLOAD_STORE_FILE=../ubiquity.keystore',
    'MYAPP_UPLOAD_KEY_ALIAS=ubiquity',
    'MYAPP_UPLOAD_STORE_PASSWORD=',
    'MYAPP_UPLOAD_KEY_PASSWORD=',
  ];

  for (const entry of entries) {
    const key = entry.split('=')[0];
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(next)) {
      next = next.replace(re, entry);
    } else {
      next = `${next.trimEnd()}\n${entry}\n`;
    }
  }

  return next;
}

const withNativeBuildFixes = (config) => {
  config = withAppDelegate(config, (config) => {
    if (config.modResults.language === 'swift') {
      config.modResults.contents = patchIosAppDelegate(config.modResults.contents);
    }
    return config;
  });

  config = withXcodeProject(config, (config) => {
    const project = config.modResults;
    const configs = project.pbxXCBuildConfigurationSection();

    for (const key of Object.keys(configs)) {
      const cfg = configs[key];
      if (!cfg || typeof cfg !== 'object' || !cfg.buildSettings) continue;
      if (cfg.name === 'Release') {
        cfg.buildSettings.SENTRY_DISABLE_AUTO_UPLOAD = 'true';
      }
    }

    return config;
  });

  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const androidRoot = config.modRequest.platformProjectRoot;
      const appBuildGradlePath = path.join(androidRoot, 'app', 'build.gradle');
      const gradlePropertiesPath = path.join(androidRoot, 'gradle.properties');
      const androidPackage =
        config.android?.package || config.android?.applicationId || 'com.example.app';
      const packagePath = androidPackage.split('.').join(path.sep);
      const mainApplicationPath = path.join(
        androidRoot,
        'app',
        'src',
        'main',
        'java',
        packagePath,
        'MainApplication.kt'
      );

      if (fs.existsSync(mainApplicationPath)) {
        const src = fs.readFileSync(mainApplicationPath, 'utf8');
        fs.writeFileSync(mainApplicationPath, patchAndroidMainApplication(src));
      }

      if (fs.existsSync(appBuildGradlePath)) {
        const src = fs.readFileSync(appBuildGradlePath, 'utf8');
        fs.writeFileSync(appBuildGradlePath, patchAndroidAppBuildGradle(src));
      }

      if (fs.existsSync(gradlePropertiesPath)) {
        const src = fs.readFileSync(gradlePropertiesPath, 'utf8');
        fs.writeFileSync(gradlePropertiesPath, patchAndroidGradleProperties(src));
      }

      return config;
    },
  ]);

  return config;
};

module.exports = createRunOncePlugin(
  withNativeBuildFixes,
  'with-ios-appdelegate-fix',
  appVersion
);
