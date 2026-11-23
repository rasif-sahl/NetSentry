import type { Metadata } from "next";
import { AccountLinkPanel } from "@/features/account/account-link-panel";

export const metadata: Metadata = { title: "Create your account | NetSentry" };

export default function Register() {
  return <AccountLinkPanel mode="register" />;
}
