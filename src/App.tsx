import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./styles/App.css";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8 text-center">
          Welcome to AIPIX
        </h1>

        <div className="max-w-md mx-auto bg-gray-800 rounded-lg p-6 shadow-lg">
          <div className="mb-4">
            <input
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="Enter a name..."
              value={name}
            />
          </div>

          <button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
            onClick={() => greet()}
          >
            Greet
          </button>

          {greetMsg && (
            <p className="mt-4 text-center text-green-400">{greetMsg}</p>
          )}
        </div>

        <div className="mt-12 text-center text-gray-400">
          <p>Modern Pixel Art Editor</p>
          <p className="text-sm mt-2">
            Powered by Tauri + React + Rust
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
