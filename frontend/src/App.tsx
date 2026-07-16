import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AnalyzePage } from './pages/AnalyzePage'
import { CoachPage } from './pages/CoachPage'
import { PlayPage } from './pages/PlayPage'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<AnalyzePage />} />
          <Route path="/play" element={<PlayPage />} />
          <Route path="/coach" element={<CoachPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
