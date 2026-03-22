import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebaseConfig';
import { UserProfile, AppSettings } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  settings: AppSettings | null;
  loading: boolean;
  isAdmin: boolean;
  isOtherDirectorate: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  settings: null,
  loading: true,
  isAdmin: false,
  isOtherDirectorate: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let unsubscribeSettings: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Listen to user profile
        const userDocRef = doc(db, 'usuarios', firebaseUser.uid);
        unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data() as UserProfile;
            setProfile(userData);
          } else {
            setProfile(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("Erro ao carregar perfil:", error);
          setLoading(false);
        });

        // Listen to app settings (for initial balance)
        const settingsDocRef = doc(db, 'configuracoes', 'geral');
        unsubscribeSettings = onSnapshot(settingsDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setSettings(docSnap.data() as AppSettings);
          } else {
            setSettings(null);
          }
        });
      } else {
        setProfile(null);
        setSettings(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeSettings) unsubscribeSettings();
    };
  }, []);

  const value = {
    user,
    profile,
    settings,
    loading,
    isAdmin: profile?.diretorFinanceiro === true,
    isOtherDirectorate: profile?.outrasDiretorias === true,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
