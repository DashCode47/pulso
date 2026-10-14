import { Redirect } from 'expo-router';
import { useAuthStore } from '../features/auth/store';
import { useOnboarding } from '../features/onboarding/store';

export default function Index() {
  const user = useAuthStore((s) => s.user);
  const onboardingSeen = useOnboarding((s) => s.seen);
  return <Redirect href={user ? '/home' : onboardingSeen ? '/sign-in' : '/onboarding'} />;
}
