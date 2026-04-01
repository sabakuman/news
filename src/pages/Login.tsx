import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const userData = await response.json();
        login(userData);
        navigate('/');
      } else {
        const data = await response.json();
        setError(data.error || 'خطأ في اسم المستخدم أو كلمة المرور');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError('حدث خطأ أثناء الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary relative overflow-hidden arabic-font" dir="rtl">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary-container blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] rounded-full bg-secondary-container blur-[120px]"></div>
      </div>

      <div className="w-full max-w-md p-10 bg-surface rounded-[40px] shadow-2xl z-10 relative border border-outline-variant/10">
        <div className="text-center mb-10">
          <div className="w-24 h-24 bg-primary-container text-on-primary-container rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/10 rotate-3 transition-transform hover:rotate-0">
            <span className="material-symbols-rounded text-[56px]">shield_person</span>
          </div>
          <h1 className="text-3xl font-bold text-on-surface mb-2 tracking-tight">نظام إدارة الأخبار</h1>
          <p className="text-on-surface-variant font-medium">ادارة الاتصال الحكومي</p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-error-container text-on-error-container flex items-center gap-3 rounded-2xl border border-error/20 animate-shake">
            <span className="material-symbols-rounded">error</span>
            <p className="text-sm font-bold">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mr-1">اسم المستخدم</label>
            <div className="relative">
              <span className="material-symbols-rounded absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40">person</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pr-12 pl-4 py-4 bg-surface-container-low border border-outline-variant rounded-2xl focus:ring-2 focus:ring-primary outline-none transition-all text-on-surface font-medium"
                placeholder="example@mohre.gov.ae"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mr-1">كلمة المرور</label>
            <div className="relative">
              <span className="material-symbols-rounded absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40">lock</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pr-12 pl-4 py-4 bg-surface-container-low border border-outline-variant rounded-2xl focus:ring-2 focus:ring-primary outline-none transition-all text-on-surface font-medium"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-primary text-on-primary font-bold rounded-2xl shadow-lg shadow-primary/20 hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 mt-8"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <span className="material-symbols-rounded">login</span>
                <span>دخول للنظام</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-outline-variant text-center">
          <p className="text-xs text-on-surface-variant font-medium">ادارة الاتصال الحكومي</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
