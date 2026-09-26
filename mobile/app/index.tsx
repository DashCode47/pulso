import { Redirect } from 'expo-router';
import { useAuthStore } from '../features/auth/store';

export default function Index() {
  const user = useAuthStore((s) => s.user);
  return <Redirect href={user ? '/home' : '/sign-in'} />;
}
