import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { ArrowRight, Briefcase, Heart, FileText, MessageCircle, Check, Sprout } from "lucide-react";
import "./LandingPage.css";

const LandingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const start = (role) => navigate(user ? (user.role === "seeker" ? "/seeker" : "/poster") : `/auth?role=${role}&tab=register`);
  return (
    <div className="vitala-home">
      <header className="vh-nav vh-wrap">
        <Link to="/" aria-label="VitalaMatch home"><span className="vh-wordmark"><Heart size={27} strokeWidth={1.6} />VitalaMatch<span className="vh-brand-dot">.</span></span></Link>
        <nav aria-label="Main navigation">
          <a href="#for-you" className="vh-nav-link">For workers & recruiters</a>
          <a href="#how-it-works" className="vh-nav-link">How it works</a>
          <Link to={user ? (user.role === "seeker" ? "/seeker" : "/poster") : "/auth"} className="vh-signin">{user ? "Your dashboard" : "Sign in"}<ArrowRight size={16} /></Link>
        </nav>
      </header>
      <main>
        <section className="vh-hero vh-wrap">
          <div className="vh-hero-copy">
            <p className="vh-eyebrow"><Sprout size={16} /> A little more human. A better way to connect.</p>
            <h1>Good care starts with<br /><em>the right people.</em></h1>
            <p className="vh-intro">A welcoming place for healthcare workers to find their next opportunity—and for recruiters to find the people who make a team feel complete.</p>
            <div className="vh-actions">
              <button className="vh-button" onClick={() => start("poster")} data-testid="hero-employer-btn">I’m hiring <ArrowRight size={18} /></button>
              <button className="vh-button vh-button-light" onClick={() => start("seeker")} data-testid="hero-seeker-btn">I’m looking for work <ArrowRight size={18} /></button>
            </div>
            <p className="vh-note">Travel, PRN, and your next chapter in healthcare.</p>
          </div>
          <div className="vh-hero-art" aria-label="Healthcare workers and hiring teams, connected">
            <div className="vh-orbit" />
            <div className="vh-art-label"><Heart size={15} /> People first. Always.</div>
            <div className="vh-person vh-person-worker"><span className="vh-avatar"><Heart size={30} /></span><span className="vh-mini-label">YOUR NEXT CHAPTER</span><h2>Room to grow.<br />A place to belong.</h2><div className="vh-tags"><span>Meaningful work</span><span>A fresh start</span></div></div>
            <div className="vh-connection"><span /><Heart size={20} /><span /></div>
            <div className="vh-person vh-person-team"><span className="vh-avatar"><Briefcase size={29} /></span><span className="vh-mini-label">YOUR NEXT TEAMMATE</span><h2>The right people.<br />A stronger team.</h2><div className="vh-tags"><span>Shared purpose</span><span>Better connections</span></div></div>
            <p className="vh-art-caption">Different journeys. A shared purpose.</p>
          </div>
        </section>
        <div className="vh-values"><div className="vh-wrap"><span>Built around people</span><span>Made for healthcare</span><span>From first hello to what’s next</span></div></div>
        <section id="for-you" className="vh-section vh-wrap">
          <div className="vh-section-heading"><p className="vh-eyebrow">TWO SIDES. ONE CONNECTION.</p><h2>Wherever you’re headed,<br />there’s a place for you here.</h2></div>
          <div className="vh-audiences">
            <article className="vh-audience vh-hiring"><span className="vh-icon"><Briefcase size={23} /></span><p className="vh-mini-label">FOR RECRUITERS & HIRING TEAMS</p><h3>Find your people.</h3><p>Behind every open role is a team that needs support. Bring your opportunities to healthcare workers ready for their next move.</p><ul><li><Check size={17} /> Post roles and share what makes your team unique</li><li><Check size={17} /> Review worker profiles and relevant credentials</li><li><Check size={17} /> Keep conversations and offers in one place</li></ul><button className="vh-text-button" onClick={() => start("poster")}>Start building your team <ArrowRight size={18} /></button></article>
            <article className="vh-audience vh-working"><span className="vh-icon"><Sprout size={23} /></span><p className="vh-mini-label">FOR HEALTHCARE WORKERS</p><h3>Find your next chapter.</h3><p>A new setting, more flexibility, or a fresh direction. Give your experience a home and explore opportunities that fit what comes next.</p><ul><li><Check size={17} /> Create one profile that tells your professional story</li><li><Check size={17} /> Keep documents and credentials together</li><li><Check size={17} /> Connect with employers and explore your matches</li></ul><button className="vh-text-button" onClick={() => start("seeker")}>Create your free worker profile <ArrowRight size={18} /></button></article>
          </div>
        </section>
        <section id="how-it-works" className="vh-process">
          <div className="vh-wrap"><div className="vh-section-heading"><p className="vh-eyebrow">LESS BACK-AND-FORTH. MORE POSSIBILITY.</p><h2>A simpler way to get to know each other.</h2></div><div className="vh-steps">
            {[{ icon: FileText, title: "Make yourself at home", copy: "Tell your story with a worker profile, or introduce your team and the roles you’re hiring for." }, { icon: Heart, title: "Find a connection", copy: "Explore opportunities and professional profiles with the details that help you see a potential fit." }, { icon: MessageCircle, title: "Take the next step", copy: "Start a conversation, share an offer, and keep the important details together as you move forward." }].map(({ icon: Icon, title, copy }, i) => <article key={title}><div className="vh-step-top"><Icon size={24} /><span>0{i + 1}</span></div><h3>{title}</h3><p>{copy}</p></article>)}
          </div></div>
        </section>
        <section className="vh-closing vh-wrap"><Sprout size={30} /><p className="vh-eyebrow">LET’S SEE WHAT’S NEXT.</p><h2>Your next great connection<br />could start right here.</h2><p>A teammate who makes the difference. An opportunity that feels right.</p><div className="vh-actions"><button className="vh-button" onClick={() => start("poster")}>Find healthcare talent <ArrowRight size={18} /></button><button className="vh-button vh-button-light" onClick={() => start("seeker")}>Find my next opportunity <ArrowRight size={18} /></button></div></section>
      </main>
      <footer className="vh-footer vh-wrap"><Link to="/"><span className="vh-wordmark"><Heart size={27} strokeWidth={1.6} />VitalaMatch<span className="vh-brand-dot">.</span></span></Link><span>Healthcare connections, with people at the heart.</span><div><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><span>© {new Date().getFullYear()} VitalaMatch</span></div></footer>
    </div>
  );
};
export default LandingPage;
