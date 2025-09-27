import type { PropsWithChildren } from "react";
import UserGuard from "@/components/user/UserGuard";

export default function UserPanelLayout({ children }: PropsWithChildren) {
  return <UserGuard>{children}</UserGuard>;
}
