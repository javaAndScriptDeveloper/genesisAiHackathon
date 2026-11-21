import { redirect } from "next/navigation";

// The Gym Bro screen moved into the Community tab.
export default function Page() {
	redirect("/community");
}
