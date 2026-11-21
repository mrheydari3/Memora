import { Redirect } from 'expo-router';

/** Keep old /library deep links working after the tab moved to /review. */
export default function LegacyLibraryRedirect() {
  return <Redirect href="/review" />;
}
