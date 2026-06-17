import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, useLocation } from 'react-router';
import PlayerManager from '../components/admin/PlayerManager';
import DayManager from '../components/admin/DayManager';

type Tab = 'joueurs' | 'tournoi';

function getTabFromHash(hash: string): Tab {
  return hash === '#tournoi' ? 'tournoi' : 'joueurs';
}

export default function Admin() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>(() => getTabFromHash(location.hash));

  function handleLogout() {
    logout();
    navigate('/admin/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-eds-dark p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl text-eds-cyan">Backoffice Admin</h1>
        <button
          onClick={handleLogout}
          className="rounded border border-eds-gray/40 px-4 py-2 font-body text-sm text-eds-light transition-colors hover:border-eds-cyan"
        >
          Déconnexion
        </button>
      </div>

      <div className="mt-6 border-b border-eds-gray/20">
        <nav className="flex gap-6">
          <button
            onClick={() => { setActiveTab('joueurs'); window.location.hash = 'joueurs'; }}
            className={`pb-3 font-heading text-lg transition-colors ${
              activeTab === 'joueurs'
                ? 'border-b-2 border-eds-cyan text-eds-cyan'
                : 'text-eds-gray hover:text-eds-light'
            }`}
          >
            Joueurs
          </button>
          <button
            onClick={() => { setActiveTab('tournoi'); window.location.hash = 'tournoi'; }}
            className={`pb-3 font-heading text-lg transition-colors ${
              activeTab === 'tournoi'
                ? 'border-b-2 border-eds-cyan text-eds-cyan'
                : 'text-eds-gray hover:text-eds-light'
            }`}
          >
            Tournoi
          </button>
        </nav>
      </div>

      {activeTab === 'joueurs' && <PlayerManager />}
      {activeTab === 'tournoi' && <DayManager />}
    </div>
  );
}
