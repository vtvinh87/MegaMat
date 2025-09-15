
import React, { useEffect } from 'react';
import { Header } from './Header';
import { NotificationTray } from './NotificationTray';
import { useData } from '../../contexts/DataContext';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useData();

  useEffect(() => {
    const body = document.body;
    if (theme === 'dark') {
      body.classList.add('dark');
    } else {
      body.classList.remove('dark');
    }
  }, [theme]);
  
  return (
    <div className="min-h-screen flex flex-col bg-bg-base">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
      <NotificationTray />
      <footer className="bg-bg-surface text-text-muted text-center p-4 mt-auto border-t border-border-base transition-colors duration-200">
        <p className="text-sm">&copy; Mega Laundromat 2025. All rights reserved.</p>
      </footer>
    </div>
  );
};
