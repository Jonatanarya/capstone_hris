import { cookies } from "next/headers";
import { FLOW_COOKIE, readAuthFlow } from "@/lib/auth-flow";
import RecoveryForm from "./recovery-form";

export default async function RecoveryPage() {
  const flow = readAuthFlow((await cookies()).get(FLOW_COOKIE)?.value);
  return (
    <RecoveryForm valid={Boolean(flow)} invitation={flow?.type === "invite"} />
  );
}
