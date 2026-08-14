export type User = {
  // default
  id: string;
  employee_id: string;
  username: string;
  email: string;
  job_title?: string;
  job_category?: string;

  // new
  name?: string;
  profilePicture?: string; // base64 picture
};
