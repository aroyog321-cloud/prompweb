import { NavigationManager } from "../../components/NavigationManager";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <NavigationManager />
      {children}
    </>
  );
}
