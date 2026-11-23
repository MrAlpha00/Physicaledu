import Link from "next/link";
import { Brand } from "@/components/layout/brand";

export function PublicFooter() {
  return (
    <footer className="border-t-4 border-navy bg-navy text-chalk">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Brand inverse />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-chalk/65">
            A connected home for college physical education — built for students,
            taught by people who know the department.
          </p>
        </div>
        <div>
          <p className="eyebrow text-lime">Account</p>
          <ul className="mt-4 space-y-3 text-sm text-chalk/75">
            <li><Link className="hover:text-lime" href="/register">Student registration</Link></li>
            <li><Link className="hover:text-lime" href="/login">Sign in</Link></li>
            <li><Link className="hover:text-lime" href="/forgot-password">Reset password</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow text-lime">Platform</p>
          <ul className="mt-4 space-y-3 text-sm text-chalk/75">
            <li><Link className="hover:text-lime" href="/#platform">How it works</Link></li>
            <li><Link className="hover:text-lime" href="/#for-students">Student access</Link></li>
            <li><Link className="hover:text-lime" href="/#for-staff">PE administration</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow text-lime">Explore</p>
          <ul className="mt-4 space-y-3 text-sm text-chalk/75">
            <li><Link className="hover:text-lime" href="/events">Events</Link></li>
            <li><Link className="hover:text-lime" href="/games">Games</Link></li>
            <li><Link className="hover:text-lime" href="/game-rules">Game Rules</Link></li>
            <li><Link className="hover:text-lime" href="/public-info">Public Info</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-chalk/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-5 text-[0.7rem] uppercase tracking-[0.12em] text-chalk/60 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>College Physical Education Department</span>
          <span>VARSITY — Athletic Digital Experience</span>
        </div>
      </div>
    </footer>
  );
}
