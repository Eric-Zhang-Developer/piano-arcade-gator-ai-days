import { Shots } from "../../game/video-shots/Cards";
import { isCard } from "../../game/video-shots";

// /shots?card=title|end: the video's cards, for recording under ?capture=1 (video-shots). No nav slot, linked from
// nowhere; with no card it lists them.
export default async function ShotsPage({ searchParams }: PageProps<"/shots">) {
  const { card } = await searchParams;
  return <Shots card={isCard(card) ? card : undefined} />;
}
