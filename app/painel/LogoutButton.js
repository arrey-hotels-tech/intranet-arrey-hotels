'use client';

import { useRouter } from 'next/navigation';
import { logout } from '@/app/actions/authActions';

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <button className="btn ghost small" onClick={handleLogout}>Sair</button>
  );
}
