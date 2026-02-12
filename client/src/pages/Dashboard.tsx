import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Github, LogOut, Zap, TrendingUp, Code2, Brain, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  // Queries
  const metricsQuery = trpc.analytics.metrics.useQuery();
  const skillTimelineQuery = trpc.analytics.skillTimeline.useQuery();
  const commitPatternsQuery = trpc.analytics.commitPatterns.useQuery();
  const topLanguagesQuery = trpc.analytics.topLanguages.useQuery();
  const insightsQuery = trpc.insights.latest.useQuery();
  const githubStatusQuery = trpc.github.status.useQuery();

  // Mutations
  const syncGitHubMutation = trpc.github.sync.useMutation();
  const calculateMetricsMutation = trpc.analytics.calculate.useMutation();
  const generateInsightsMutation = trpc.insights.generate.useMutation();

  const handleSync = async () => {
    setIsLoading(true);
    try {
      await syncGitHubMutation.mutateAsync();
      await calculateMetricsMutation.mutateAsync();
      metricsQuery.refetch();
      skillTimelineQuery.refetch();
      commitPatternsQuery.refetch();
      topLanguagesQuery.refetch();
      toast.success("GitHub data synced successfully!");
    } catch (error) {
      toast.error("Failed to sync GitHub data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateInsights = async () => {
    setIsLoading(true);
    try {
      await generateInsightsMutation.mutateAsync();
      insightsQuery.refetch();
      toast.success("Insights generated successfully!");
    } catch (error) {
      toast.error("Failed to generate insights");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const metrics = metricsQuery.data;
  const skillTimeline = skillTimelineQuery.data || [];
  const commitPatterns = commitPatternsQuery.data;
  const topLanguages = topLanguagesQuery.data || [];
  const insights = insightsQuery.data;

  // Prepare chart data
  const skillChartData = skillTimeline.map((lang: any) => ({
    name: lang.language,
    commits: lang.commitCount,
    repos: lang.repositoryCount,
  }));

  const depthBreadthData = metrics
    ? [
        { name: "Depth", value: metrics.projectDepth },
        { name: "Breadth", value: 100 - metrics.projectDepth },
      ]
    : [];

  const COLORS = ["#06b6d4", "#ec4899"];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded flex items-center justify-center">
              <span className="text-white font-bold text-lg">T</span>
            </div>
            <h1 className="text-2xl font-black">TRAJECTA</h1>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-12">
        {/* Top Actions */}
        <div className="flex gap-4 mb-12">
          <Button
            onClick={handleSync}
            disabled={isLoading || syncGitHubMutation.isPending}
            className="bg-black hover:bg-gray-900 text-white flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Sync GitHub
          </Button>

          <Button
            onClick={handleGenerateInsights}
            disabled={isLoading || generateInsightsMutation.isPending}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Brain className="w-4 h-4" />
            Generate Insights
          </Button>
        </div>

        {/* Metrics Grid */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <Card className="border-2 border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-pink-500" />
                  Consistency Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-black text-black">{metrics.consistencyScore}</div>
                <p className="text-xs text-gray-600 mt-2">out of 100</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-500" />
                  Learning Velocity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-black text-black">{metrics.learningVelocity}</div>
                <p className="text-xs text-gray-600 mt-2">commits/day</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-pink-500" />
                  Project Depth
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-black text-black">{metrics.projectDepth}</div>
                <p className="text-xs text-gray-600 mt-2">out of 100</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Github className="w-4 h-4 text-cyan-500" />
                  Total Commits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-black text-black">{metrics.totalCommits}</div>
                <p className="text-xs text-gray-600 mt-2">across {metrics.totalRepositories} repos</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts */}
        <Tabs defaultValue="skills" className="mb-12">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="skills">Skill Growth</TabsTrigger>
            <TabsTrigger value="depth">Depth vs Breadth</TabsTrigger>
            <TabsTrigger value="patterns">Commit Patterns</TabsTrigger>
          </TabsList>

          <TabsContent value="skills" className="mt-6">
            <Card className="border-2 border-gray-200">
              <CardHeader>
                <CardTitle>Skill Growth Timeline</CardTitle>
                <CardDescription>Commits by programming language</CardDescription>
              </CardHeader>
              <CardContent>
                {skillChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={skillChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="commits" fill="#06b6d4" name="Commits" />
                      <Bar dataKey="repos" fill="#ec4899" name="Repositories" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    No data available. Sync your GitHub data first.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="depth" className="mt-6">
            <Card className="border-2 border-gray-200">
              <CardHeader>
                <CardTitle>Depth vs Breadth Analysis</CardTitle>
                <CardDescription>Specialization vs diversification balance</CardDescription>
              </CardHeader>
              <CardContent>
                {metrics && depthBreadthData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={depthBreadthData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {COLORS.map((color, index) => (
                          <Cell key={`cell-${index}`} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    No data available.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="patterns" className="mt-6">
            <Card className="border-2 border-gray-200">
              <CardHeader>
                <CardTitle>Commit Patterns</CardTitle>
                <CardDescription>Your development activity analysis</CardDescription>
              </CardHeader>
              <CardContent>
                {commitPatterns ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded border border-gray-200">
                        <p className="text-sm text-gray-600 mb-1">Avg Commits/Day</p>
                        <p className="text-2xl font-bold">{commitPatterns.averageCommitsPerDay}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded border border-gray-200">
                        <p className="text-sm text-gray-600 mb-1">Peak Activity</p>
                        <p className="text-2xl font-bold">{commitPatterns.peakDay}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded border border-gray-200">
                        <p className="text-sm text-gray-600 mb-1">Pattern Type</p>
                        <p className="text-sm font-bold">
                          {commitPatterns.burstyPattern
                            ? "Burst-based"
                            : commitPatterns.consistentPattern
                              ? "Consistent"
                              : "Mixed"}
                        </p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded border border-gray-200">
                        <p className="text-sm text-gray-600 mb-1">Consistency</p>
                        <p className="text-sm font-bold">
                          {commitPatterns.consistentPattern ? "High" : commitPatterns.burstyPattern ? "Low" : "Medium"}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-gray-500">
                    No data available.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* AI Insights */}
        {insights && (
          <Card className="border-2 border-pink-500 bg-pink-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-pink-600" />
                AI-Powered Growth Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-bold text-black mb-3">Summary</h3>
                <p className="text-gray-700">{insights.summary}</p>
              </div>

              <div>
                <h3 className="font-bold text-black mb-3">Key Insights</h3>
                <div className="space-y-3">
                  {insights.insights?.map((insight: any, idx: number) => (
                    <div key={idx} className="p-3 bg-white rounded border border-pink-200">
                      <p className="font-semibold text-black">{insight.title}</p>
                      <p className="text-sm text-gray-700 mt-1">{insight.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-bold text-black mb-3">Recommendations</h3>
                <div className="space-y-3">
                  {insights.recommendations?.map((rec: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-3 rounded border ${
                        rec.priority === "high"
                          ? "bg-red-50 border-red-200"
                          : rec.priority === "medium"
                            ? "bg-yellow-50 border-yellow-200"
                            : "bg-green-50 border-green-200"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-black">{rec.area}</p>
                          <p className="text-sm text-gray-700 mt-1">{rec.suggestion}</p>
                        </div>
                        <span
                          className={`text-xs font-bold px-2 py-1 rounded ${
                            rec.priority === "high"
                              ? "bg-red-200 text-red-800"
                              : rec.priority === "medium"
                                ? "bg-yellow-200 text-yellow-800"
                                : "bg-green-200 text-green-800"
                          }`}
                        >
                          {rec.priority.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
