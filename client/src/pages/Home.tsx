import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Github, TrendingUp, Zap, BarChart3, Brain } from "lucide-react";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Grid background with geometric shapes */}
      <div className="absolute inset-0 opacity-5">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="black" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Decorative geometric shapes */}
      <div className="absolute top-20 right-10 w-64 h-64 opacity-10">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <polygon points="100,10 190,190 10,190" fill="none" stroke="#06b6d4" strokeWidth="2" />
          <circle cx="100" cy="100" r="50" fill="none" stroke="#ec4899" strokeWidth="2" />
        </svg>
      </div>

      <div className="absolute bottom-20 left-10 w-80 h-80 opacity-10">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <rect x="20" y="20" width="160" height="160" fill="none" stroke="#06b6d4" strokeWidth="2" />
          <line x1="100" y1="20" x2="100" y2="180" stroke="#ec4899" strokeWidth="1" />
          <line x1="20" y1="100" x2="180" y2="100" stroke="#ec4899" strokeWidth="1" />
        </svg>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex justify-between items-center px-8 py-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-black rounded flex items-center justify-center">
            <span className="text-white font-bold text-lg">T</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">TRAJECTA</h1>
        </div>
        <div className="flex gap-4">
          {!isAuthenticated && (
            <Button asChild variant="outline">
              <a href={getLoginUrl()}>Sign In</a>
            </Button>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10">
        <div className="max-w-6xl mx-auto px-8 py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left: Content */}
            <div>
              <h2 className="text-6xl font-black leading-tight mb-6 text-black">
                Measure Your
                <br />
                <span className="bg-gradient-to-r from-cyan-500 to-pink-500 bg-clip-text text-transparent">
                  Developer Growth
                </span>
              </h2>

              <p className="text-xl text-gray-700 mb-8 leading-relaxed font-light">
                Trajecta analyzes your GitHub activity to reveal your learning patterns, consistency, and growth trajectory. Get AI-powered insights into your development journey.
              </p>

              <div className="space-y-4 mb-12">
                <div className="flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-white text-sm font-bold">✓</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-black mb-1">Real-time Analytics</h3>
                    <p className="text-gray-600 text-sm">Track commits, languages, and project metrics automatically</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-white text-sm font-bold">✓</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-black mb-1">AI-Powered Insights</h3>
                    <p className="text-gray-600 text-sm">Get personalized recommendations for skill development</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-white text-sm font-bold">✓</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-black mb-1">Growth Metrics</h3>
                    <p className="text-gray-600 text-sm">Consistency score, learning velocity, and depth analysis</p>
                  </div>
                </div>
              </div>

              <Button
                asChild
                size="lg"
                className="bg-black hover:bg-gray-900 text-white font-bold px-8 py-6 text-lg"
              >
                <a href={getLoginUrl()} className="flex items-center gap-2">
                  <Github className="w-5 h-5" />
                  Connect with GitHub
                </a>
              </Button>
            </div>

            {/* Right: Feature Cards */}
            <div className="space-y-6">
              <div className="bg-white border-2 border-gray-200 p-8 hover:border-cyan-500 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-cyan-100 rounded">
                    <TrendingUp className="w-6 h-6 text-cyan-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-black mb-2">Skill Growth Timeline</h3>
                    <p className="text-sm text-gray-600">Visualize how your programming skills evolve over time</p>
                  </div>
                </div>
              </div>

              <div className="bg-white border-2 border-gray-200 p-8 hover:border-pink-500 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-pink-100 rounded">
                    <Zap className="w-6 h-6 text-pink-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-black mb-2">Consistency Score</h3>
                    <p className="text-sm text-gray-600">Measure your commit frequency and development consistency</p>
                  </div>
                </div>
              </div>

              <div className="bg-white border-2 border-gray-200 p-8 hover:border-cyan-500 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-cyan-100 rounded">
                    <BarChart3 className="w-6 h-6 text-cyan-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-black mb-2">Depth vs Breadth</h3>
                    <p className="text-sm text-gray-600">Understand your specialization vs diversification balance</p>
                  </div>
                </div>
              </div>

              <div className="bg-white border-2 border-gray-200 p-8 hover:border-pink-500 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-pink-100 rounded">
                    <Brain className="w-6 h-6 text-pink-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-black mb-2">AI Recommendations</h3>
                    <p className="text-sm text-gray-600">Personalized growth suggestions based on your patterns</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 mt-24 py-12">
          <div className="max-w-6xl mx-auto px-8 text-center text-gray-600 text-sm">
            <p>© 2026 Trajecta. Powered by AI-driven developer analytics.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
