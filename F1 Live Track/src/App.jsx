import logo from './assets/logo.png';
import track from './assets/Tracks/montreal-6.svg'

function App() {
  return (
    <>
      <nav>
        <img src={logo} alt="logo" />

        <div className='nav-menu'>
          <span>Home</span>
          <span>Drivers</span>
          <span>Circuits</span>
        </div>
      </nav>

      <main>
        <div className='leaderboard'>
          <h2>Leaderboard</h2>
        </div>

        <div className='track'>
          <img src={track} alt="track" className='track-map' />
          <div className='driver-dot'></div>
        </div>
      </main>

    </>
  )
}

export default App;