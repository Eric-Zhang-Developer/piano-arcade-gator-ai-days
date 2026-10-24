import { redirect } from "next/navigation";

// Placeholder front door until song-select replaces it.
export default function Home() {
  redirect("/play");
}
