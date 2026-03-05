import { google } from "googleapis";

export function getAuth() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
  return auth;
}

export function getDrive() {
  return google.drive({ version: "v3", auth: getAuth() });
}

export function getGmail() {
  return google.gmail({ version: "v1", auth: getAuth() });
}

export function getCalendar() {
  return google.calendar({ version: "v3", auth: getAuth() });
}

export function getTasks() {
  return google.tasks({ version: "v1", auth: getAuth() });
}
