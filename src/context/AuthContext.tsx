import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isAdmin: boolean;
  isEditor: boolean;
  isReviewer: boolean;
  isSectorApprover: boolean;
  isFinalApprover: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
          if (userDoc.exists()) {
            setUser(userDoc.data() as User);
          } else {
            // Create user doc if it doesn't exist
            const newUser: User = {
              uid: fbUser.uid,
              name: fbUser.displayName || 'مستخدم جديد',
              email: fbUser.email || '',
              role: fbUser.email === 'Sabakuman@gmail.com' ? 'admin' : 'viewer',
              status: 'active',
              departmentId: 'media_dept'
            };
            await setDoc(doc(db, 'users', fbUser.uid), newUser);
            setUser(newUser);
          }
        } catch (error) {
          console.error('Error fetching user doc:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = {
    user,
    firebaseUser,
    loading,
    isAdmin: user?.role === 'admin',
    isEditor: user?.role === 'editor',
    isReviewer: user?.role === 'reviewer',
    isSectorApprover: user?.role === 'sector_approver',
    isFinalApprover: user?.role === 'final_approver',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
