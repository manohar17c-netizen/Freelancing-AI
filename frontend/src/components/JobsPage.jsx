import { useState } from "react";

export default function JobsPage() {
  const [description, setDescription] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [minExperience, setMinExperience] = useState(0);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [matches, setMatches] = useState([]);

  async function onSubmit(event) {
    event.preventDefault();
    setStatus({ type: "", message: "Matching candidates..." });
    setMatches([]);

    const payload = {
      description,
      required_skills: requiredSkills
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      min_experience_years: Number(minExperience) || 0,
    };

    try {
      const response = await fetch("/post-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Job matching failed.");
      }
      setMatches(data.top_matches || []);
      setStatus({ type: "success", message: `Found ${(data.top_matches || []).length} top matches.` });
    } catch (error) {
      setStatus({ type: "warning", message: error.message });
    }
  }

  return (
    <div className="page">
      <main className="container">
        <div className="brand-row">
          <div className="logo">
            <span>Freelancing</span>AI
          </div>
          <a className="text-link" href="/auth/start/google?next=/ui/resume">
            Freelancer Signup / Login with Google
          </a>
        </div>

        <article className="panel card-shadow">
          <h1>Post a job and match top freelancers</h1>
          <p className="muted">
            Describe your project and instantly receive ranked recommendations based on semantic fit, required skills,
            and experience.
          </p>

          <form onSubmit={onSubmit}>
            <label htmlFor="description">Job description</label>
            <textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              minLength={10}
              required
            />

            <label htmlFor="required-skills">Required skills (comma-separated)</label>
            <input
              id="required-skills"
              value={requiredSkills}
              onChange={(event) => setRequiredSkills(event.target.value)}
              placeholder="react, node, aws"
            />

            <label htmlFor="min-experience">Minimum experience years</label>
            <input
              id="min-experience"
              type="number"
              min={0}
              value={minExperience}
              onChange={(event) => setMinExperience(event.target.value)}
            />

            <button type="submit">Find Best Freelancers</button>
            <p className={`message ${status.type}`}>{status.message}</p>
          </form>

          {matches.length > 0 && (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Headline</th>
                    <th>Final Score</th>
                    <th>Skill</th>
                    <th>Experience</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((item) => (
                    <tr key={item.resume_id}>
                      <td>{item.name}</td>
                      <td>{item.headline}</td>
                      <td>{item.final_score}</td>
                      <td>{item.skill_score}</td>
                      <td>{item.experience_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </main>
    </div>
  );
}
