import { redirect } from "next/navigation";

/** The workflow always belongs to a case; pick one first. */
export default function WorkflowIndex() {
  redirect("/cases");
}
