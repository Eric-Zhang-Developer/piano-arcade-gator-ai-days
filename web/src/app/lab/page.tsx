import { APP_NAME } from "../../game/app-name";
import { Lab } from "../../game/lab/Lab";

// /lab (spec: lab): every experimental and hidden feature, one link each.
export const metadata = { title: `Lab · ${APP_NAME}` };

export default function LabPage() {
  return <Lab />;
}
