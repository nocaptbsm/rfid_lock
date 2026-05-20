import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { studentLogin as studentLoginApi } from '@/api';
import { ArrowRight, AlertCircle, Loader2, ShieldCheck, User, MapPin, BookOpen, Star, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Image slideshow data ─────────────────────────────────────── */
const SLIDES = [
  { src: '/library1.png', caption: 'Peaceful Study Environment' },
  { src: '/library2.png', caption: 'Students Deep in Focus' },
  { src: '/library3.png', caption: 'Well-Organised Study Spaces' },
];

/* ─── Feature badges ───────────────────────────────────────────── */
const FEATURES = [
  { icon: BookOpen, label: 'Vast Book Collection' },
  { icon: Wifi,     label: 'RFID Smart Access'   },
  { icon: Star,     label: 'Friendly Staff'       },
];

const StudentLogin = () => {
  const [roll, setRoll]         = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [slideIdx, setSlideIdx] = useState(0);
  const { login }               = useAuth();
  const navigate                = useNavigate();

  /* auto-advance slideshow */
  useEffect(() => {
    const t = setInterval(() => setSlideIdx(i => (i + 1) % SLIDES.length), 4000);
    return () => clearInterval(t);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!roll.trim() || !password.trim()) return setError('Please enter your Card UID and Password');

    setLoading(true);
    setError('');

    try {
      const result = await studentLoginApi(roll.toUpperCase(), password);
      
      if (result.student.role === 'MASTER') {
        setError('Master keys cannot be used for student login.');
        setLoading(false);
        return;
      }

      login({
        roll:  result.student.roll_no,
        name:  result.student.name || 'Student',
        uid:   result.student.uid,
        role:  'student',
        token: result.token,   // JWT for requireStudent-guarded endpoints
      });
      navigate(`/student/${result.student.roll_no}`);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 400) {
        setError('Invalid UID or Password. Please try again.');
      } else {
        setError(err.response?.data?.error || 'Unable to login right now.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing-root">
      {/* ════════════════════════════════════════════════════
          LEFT PANEL — Branding
      ════════════════════════════════════════════════════ */}
      <div className="left-panel">
        {/* Slideshow background */}
        <AnimatePresence mode="wait">
          <motion.div
            key={slideIdx}
            className="slide-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            style={{ backgroundImage: `url(${SLIDES[slideIdx].src})` }}
          />
        </AnimatePresence>

        {/* Dark gradient overlay */}
        <div className="left-overlay" />

        {/* Content */}
        <div className="left-content">
          {/* Logo + Name */}
          <motion.div
            className="brand-header"
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7 }}
          >
            <div className="logo-ring">
              <img src="/logo.png" alt="स्व-अध्ययन Library Logo" className="logo-img" />
            </div>
            <div>
              <h1 className="brand-name">स्व-अध्ययन Library</h1>
              <p className="brand-tagline">Always Depend on Yourself, Never on Others</p>
            </div>
          </motion.div>

          {/* Description */}
          <motion.div
            className="brand-body"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.7 }}
          >
            <p className="brand-desc">
              Welcome to <strong>स्व-अध्ययन Library</strong> — a sanctuary of knowledge 
              and focused learning. We provide a serene, distraction-free environment 
              equipped with an extensive collection of books, journals, and study resources 
              to fuel every student's ambition.
            </p>
            <p className="brand-desc" style={{ marginTop: '0.75rem' }}>
              Our warm, knowledgeable staff are always ready to guide you to exactly 
              what you need — because at स्व-अध्ययन, your growth is our mission.
            </p>
          </motion.div>

          {/* Feature pills */}
          <motion.div
            className="feature-pills"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.7 }}
          >
            {FEATURES.map(({ icon: Icon, label }) => (
              <span key={label} className="feature-pill">
                <Icon size={14} /> {label}
              </span>
            ))}
          </motion.div>

          {/* Address */}
          <motion.div
            className="address-row"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.7 }}
          >
            <MapPin size={15} className="address-pin" />
            <span>Near Grand Mall, Muzaffarpur, Bihar</span>
          </motion.div>

          {/* Slide caption */}
          <div className="slide-caption-bar">
            <AnimatePresence mode="wait">
              <motion.span
                key={slideIdx}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.4 }}
                className="slide-caption-text"
              >
                {SLIDES[slideIdx].caption}
              </motion.span>
            </AnimatePresence>
            <div className="slide-dots">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlideIdx(i)}
                  className={`slide-dot ${i === slideIdx ? 'active' : ''}`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          RIGHT PANEL — Login Options
      ════════════════════════════════════════════════════ */}
      <div className="right-panel">
        <motion.div
          className="right-content"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="right-header">
            <h2 className="right-title">Welcome Back</h2>
            <p className="right-subtitle">Access your portal to continue your journey</p>
          </div>

          {/* ── Student Login Card ── */}
          <div className="login-card student-card">
            <div className="login-card-header">
              <div className="card-icon student-icon">
                <User size={20} />
              </div>
              <div>
                <h3 className="card-title">Student Portal</h3>
                <p className="card-sub">View attendance & seat status</p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="login-form">
              <div className="field-group">
                <label htmlFor="roll" className="field-label">Card UID</label>
                <input
                  id="roll"
                  type="text"
                  placeholder="e.g. A3B2C1D4"
                  value={roll}
                  onChange={(e) => setRoll(e.target.value)}
                  className="field-input"
                  autoComplete="off"
                />
              </div>

              <div className="field-group">
                <label htmlFor="password" className="field-label">Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field-input"
                />
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="error-msg"
                  >
                    <AlertCircle size={15} />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
              >
                {loading ? (
                  <Loader2 size={18} className="spin" />
                ) : (
                  <>Login to Portal <ArrowRight size={16} /></>
                )}
              </button>
            </form>

            <p className="rfid-hint">
              🔖 RFID Reader Active · Point your card to the scanner
            </p>
          </div>

          {/* ── Divider ── */}
          <div className="or-divider">
            <span className="or-line" />
            <span className="or-text">or</span>
            <span className="or-line" />
          </div>

          {/* ── Admin Portal Card ── */}
          <Link to="/admin-login" id="admin-portal-btn" className="login-card admin-card">
            <div className="login-card-header" style={{ pointerEvents: 'none' }}>
              <div className="card-icon admin-icon">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="card-title">Admin Portal</h3>
                <p className="card-sub">Manage members, seats & reports</p>
              </div>
            </div>
            <div className="admin-arrow">
              <span>Access Admin Dashboard</span>
              <ArrowRight size={16} />
            </div>
          </Link>
        </motion.div>

        {/* Powered by D Block */}
        <div className="powered-by">
          <span>Powered by</span>
          <span className="powered-brand">D Block</span>
        </div>
      </div>
    </div>
  );
};

export default StudentLogin;
