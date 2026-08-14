import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";


export default function ModalScreen() {
  //useScreenView("modal");

  return (
    <View className="flex-1 items-center justify-center px-5 bg-background-light dark:bg-background-dark">
      <View className="w-full max-w-md rounded-3xl border border-primary/10 bg-white dark:bg-surface-dark p-6">
        <Text className="font-serif text-4xl text-neutral-dark dark:text-[#F6EDE8]">
          This is a modal
        </Text>
        <Link href="/" dismissTo style={styles.link}>
          <Text className="font-sans text-base font-bold text-primary">
            Go to home screen
          </Text>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  link: {
    marginTop: 14,
    paddingVertical: 8,
  },
});
