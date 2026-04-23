import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

const Home: React.FC = () => {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-50">
      {/* Light Mode Dynamic Background Elements */}
      <div className="absolute top-0 left-1/4 w-full h-[500px] bg-rose-200/50 rounded-full mix-blend-multiply filter blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-0 right-1/4 w-full h-[500px] bg-teal-200/50 rounded-full mix-blend-multiply filter blur-[100px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      <div className="absolute -left-1/4 top-1/2 w-[500px] h-[500px] bg-amber-200/50 rounded-full mix-blend-multiply filter blur-[100px] animate-pulse" style={{ animationDelay: '4s' }}></div>
      
      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      <div className="relative z-10 container mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-600 text-sm font-medium mb-8 shadow-sm">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>The next generation is here</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-6 drop-shadow-sm">
          Build faster with <br className="hidden md:block"/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-purple-500 to-teal-500">
            Absolute Elegance
          </span>
        </h1>
        
        <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-600 mb-10 leading-relaxed font-light">
          A premium web application built with React, Vite, and cutting-edge design principles.
          Join us to experience unparalleled performance and aesthetics.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link 
            to="/register" 
            className="group relative inline-flex items-center justify-center gap-2 px-8 py-3.5 text-base font-semibold text-white bg-slate-900 rounded-2xl overflow-hidden transition-all hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-slate-900/20"
          >
            <span>Get Started</span>
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link 
            to="/login" 
            className="inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold text-slate-700 bg-white border border-slate-200 rounded-2xl transition-all hover:bg-slate-50 hover:text-slate-900 shadow-sm hover:shadow active:scale-[0.98]"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
