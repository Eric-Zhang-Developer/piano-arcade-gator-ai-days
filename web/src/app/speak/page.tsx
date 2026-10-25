import { APP_NAME } from "../../game/app-name";
import { Speak } from "../../game/x/speaking-piano/Speak";

// /speak (spike: speaking-piano, #1153): the piano speaks a phrase. Reached from the Lab.
export const metadata = { title: `The Speaking Piano · ${APP_NAME}` };

export default function SpeakPage() {
  return <Speak />;
}
