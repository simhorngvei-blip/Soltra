import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import menuVideo from './assets/Mainn.mp4'
import main2 from './assets/main2.mp4'
import P3Menu from './P3Menu'
import PageTransition from './PageTransition'
import NetworkGrid from './NetworkGrid'
import SystemHub from './SystemHub'
import HubMenu from './HubMenu'
import ManualControl from './ManualControl'
import SettingsPage from './SettingsPage'
import HardwareLogs from './HardwareLogs'
import './App.css'


function MenuScreen() {
  const navigate = useNavigate()
  return (
    <div id="menu-screen">
      <video src={menuVideo} autoPlay loop muted playsInline />
      <P3Menu onNavigate={(page) => navigate(`/${page}`)} />
    </div>
  )
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={
          <PageTransition><MenuScreen /></PageTransition>
        } />
        <Route path="/hub" element={
          <PageTransition variant="about"><HubMenu /></PageTransition>
        } />
        <Route path="/system" element={
          <PageTransition variant="about"><SystemHub /></PageTransition>
        } />
        <Route path="/logs" element={
          <PageTransition variant="about"><HardwareLogs /></PageTransition>
        } />
        <Route path="/network" element={
          <PageTransition variant="socials"><NetworkGrid /></PageTransition>
        } />
        <Route path="/manual" element={
          <PageTransition variant="about"><ManualControl /></PageTransition>
        } />
        <Route path="/settings" element={
          <PageTransition variant="about"><SettingsPage /></PageTransition>
        } />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  return <AnimatedRoutes />
}