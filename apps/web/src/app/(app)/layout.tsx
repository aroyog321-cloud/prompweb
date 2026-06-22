import { NavigationManager } from "../../components/NavigationManager";
import { GlobalAuthSync } from "../../components/GlobalAuthSync";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <NavigationManager />
      <GlobalAuthSync />
      {children}
    </>
  );
}
