import HrisApp from "./hris-app";
import { jakartaDate } from "@/lib/hris";

// Evaluate the date per request, not at build time.
export const dynamic = "force-dynamic";
export default function Home() {
  return <HrisApp today={jakartaDate()} />;
}
