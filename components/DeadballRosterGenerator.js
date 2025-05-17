import React, { useState } from 'react';
import Papa from 'papaparse';

export default function DeadballRosterGenerator() {
  const [battingStats, setBattingStats] = useState(null);
  const [pitchingStats, setPitchingStats] = useState(null);
  const [roster, setRoster] = useState({
    positionPlayers: [],
    startingPitchers: [],
    reliefPitchers: []
  });
  const [teamName, setTeamName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Convert batting average to Batter Target
  const calcBT = (avg) => {
    const bt = Math.round(parseFloat(avg) * 100);
    return isNaN(bt) ? 0 : bt;
  };

  // Convert on-base percentage to On Base Target
  const calcOBT = (obp) => {
    const obt = Math.round(parseFloat(obp) * 100);
    return isNaN(obt) ? 0 : obt;
  };

  // Convert ERA to Pitch Die
  const calcPD = (era) => {
    if (isNaN(parseFloat(era))) return "d4";
    const eraNum = parseFloat(era);
    
    if (eraNum < 2.00) return "d20";
    if (eraNum < 3.00) return "d12";
    if (eraNum < 4.00) return "d8";
    if (eraNum < 5.00) return "d4";
    if (eraNum < 6.00) return "-d4";
    if (eraNum < 7.00) return "-d8";
    if (eraNum < 8.00) return "-d12";
    return "-d20";
  };

  // Determine handedness based on name annotation
  const getHandedness = (name) => {
    if (!name) return 'R';
    if (name.endsWith('*')) return 'L';
    if (name.endsWith('#')) return 'S';
    return 'R';
  };

  // Remove * and # from names
  const cleanName = (name) => {
    if (!name) return '';
    return name.replace(/[*#]$/, '');
  };

  // Calculate traits based on stats
  const calcBattingTraits = (player) => {
    const traits = [];
    
    // Power hitter traits (based on HR and SLG)
    const hr = parseInt(player.HR) || 0;
    const slg = parseFloat(player.SLG) || 0;
    
    if (hr >= 35 || slg >= 0.560) {
      traits.push("P++");
    } else if (hr >= 25 || slg >= 0.475) {
      traits.push("P+");
    } else if (hr <= 5) {
      traits.push("P-");
    }
    
    // Contact hitter traits (based on doubles and strikeout rate)
    const doubles = parseInt(player['2B']) || 0;
    const pa = parseInt(player.PA) || 0;
    const kRate = pa > 0 ? (parseInt(player.SO) || 0) / pa : 0;
    
    if (doubles >= 35 || kRate < 0.12) {
      traits.push("C+");
    } else if (kRate > 0.25) {
      traits.push("C-");
    }
    
    // Speedy runner traits (based on SB)
    const sb = parseInt(player.SB) || 0;
    
    if (sb >= 20) {
      traits.push("S+");
    } else if (sb === 0) {
      traits.push("S-");
    }
    
    // Great defender traits (based on position and fielding metrics if available)
    const pos = player.Pos || '';
    if (pos.includes('C') || pos.includes('SS') || pos.includes('CF')) {
      if (parseFloat(player.WAR) > 1.5) {
        traits.push("D+");
      }
    }
    
    return traits.join(" ");
  };

  const calcPitchingTraits = (player) => {
    const traits = [];
    
    // Strikeout artist trait
    const ip = parseFloat(player.IP) || 0;
    const so = parseInt(player.SO) || 0;
    const kRate = ip > 0 ? (so * 9) / ip : 0;
    
    if (kRate >= 8) {
      traits.push("K+");
    }
    
    // Groundball machine trait
    const hr = parseInt(player.HR) || 0;
    const hr9 = ip > 0 ? (hr * 9) / ip : 0;
    const era = parseFloat(player.ERA) || 0;
    
    if (hr9 < 0.7 && era < 3.5) {
      traits.push("GB+");
    }
    
    // Control pitcher trait
    const bb = parseInt(player.BB) || 0;
    const bbRate = ip > 0 ? (bb * 9) / ip : 0;
    
    if (bbRate < 2) {
      traits.push("CN+");
    } else if (bbRate > 4) {
      traits.push("CN-");
    }
    
    // Great stamina trait
    if (ip > 170) {
      traits.push("ST+");
    }
    
    return traits.join(" ");
  };

  // Determine player position
  const getPosition = (posStr) => {
    if (!posStr) return "UT";
    
    if (posStr.includes('C')) return "C";
    if (posStr.includes('1B')) return "1B";
    if (posStr.includes('2B')) return "2B";
    if (posStr.includes('3B')) return "3B";
    if (posStr.includes('SS')) return "SS";
    if (posStr.includes('LF')) return "LF";
    if (posStr.includes('CF')) return "CF";
    if (posStr.includes('RF')) return "RF";
    
    // For utility players or DH
    if (posStr.includes('OF')) return "OF";
    if (posStr.includes('DH')) return "DH";
    return "UT";
  };

  const handleBattingUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          console.log("Batting data loaded:", results.data);
          setBattingStats(results.data);
        },
        error: (error) => {
          console.error("Error parsing batting data:", error);
        }
      });
    }
  };

  const handlePitchingUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          console.log("Pitching data loaded:", results.data);
          setPitchingStats(results.data);
        },
        error: (error) => {
          console.error("Error parsing pitching data:", error);
        }
      });
    }
  };

  const generateRoster = () => {
    if (!battingStats || !pitchingStats || battingStats.length === 0 || pitchingStats.length === 0) {
      alert("Please upload both batting and pitching stats files with valid data.");
      return;
    }

    setIsGenerating(true);

    try {
      // Process batters
      console.log("Processing batters...");
      const processedBatters = [];
      
      for (const player of battingStats) {
        // Skip players without relevant data
        if (!player.Player || !player.BA || !(parseInt(player.PA) > 0 || parseInt(player.G) > 0)) {
          continue;
        }
        
        processedBatters.push({
          name: cleanName(player.Player),
          position: getPosition(player.Pos),
          handedness: getHandedness(player.Player),
          bt: calcBT(player.BA),
          obt: calcOBT(player.OBP),
          traits: calcBattingTraits(player),
          games: parseInt(player.G) || 0,
          war: parseFloat(player.WAR) || 0
        });
      }
      
      // Sort by WAR
      processedBatters.sort((a, b) => b.war - a.war);
      console.log("Processed batters:", processedBatters);

      // Process pitchers
      console.log("Processing pitchers...");
      const processedPitchers = [];
      
      for (const player of pitchingStats) {
        // Skip players without relevant data
        if (!player.Player || !player.ERA || !(parseFloat(player.IP) > 0)) {
          continue;
        }
        
        processedPitchers.push({
          name: cleanName(player.Player),
          handedness: getHandedness(player.Player),
          pd: calcPD(player.ERA),
          bt: Math.floor(Math.random() * 10) + 10, // Random BT for pitchers
          obt: Math.floor(Math.random() * 10) + 15, // Random OBT for pitchers
          traits: calcPitchingTraits(player),
          games: parseInt(player.G) || 0,
          starts: parseInt(player.GS) || 0,
          ip: parseFloat(player.IP) || 0
        });
      }
      console.log("Processed pitchers:", processedPitchers);

      // Separate starters and relievers
      const starters = processedPitchers
        .filter(p => p.starts > 5 || (p.games > 0 && p.starts / p.games > 0.5))
        .sort((a, b) => b.ip - a.ip)
        .slice(0, 5);

      const relievers = processedPitchers
        .filter(p => !(p.starts > 5 || (p.games > 0 && p.starts / p.games > 0.5)))
        .sort((a, b) => b.ip - a.ip)
        .slice(0, 7);

      console.log("Starters:", starters);
      console.log("Relievers:", relievers);

      // Select starters for each position
      const lineup = [];
      const positions = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
      let remainingBatters = [...processedBatters];
      
      for (const pos of positions) {
        const positionPlayers = remainingBatters.filter(p => p.position === pos);
        
        if (positionPlayers.length > 0) {
          lineup.push(positionPlayers[0]);
          remainingBatters = remainingBatters.filter(p => p !== positionPlayers[0]);
        } else {
          // If no player for this position, find the best utility player
          const utility = remainingBatters.find(p => p.position === "UT" || p.position === "OF" || p.position === "DH");
          
          if (utility) {
            const newPlayer = {...utility, position: pos}; // Assign them to this position
            lineup.push(newPlayer);
            remainingBatters = remainingBatters.filter(p => p !== utility);
          } else if (remainingBatters.length > 0) {
            // Last resort: take the best remaining player
            const bestPlayer = {...remainingBatters[0], position: pos};
            lineup.push(bestPlayer);
            remainingBatters = remainingBatters.slice(1);
          }
        }
      }

      console.log("Lineup:", lineup);

      // Select bench players (top 4 remaining)
      const bench = remainingBatters.slice(0, 4);
      console.log("Bench:", bench);

      // Add dummy players if needed
      const finalBench = [...bench];
      while (finalBench.length < 4) {
        finalBench.push({
          name: `Bench Player ${finalBench.length + 1}`,
          position: "UT",
          handedness: "R",
          bt: 20,
          obt: 25,
          traits: ""
        });
      }

      const finalStarters = [...starters];
      while (finalStarters.length < 5) {
        finalStarters.push({
          name: `Starting Pitcher ${finalStarters.length + 1}`,
          pd: "d4",
          handedness: "R",
          bt: 15,
          obt: 20,
          traits: ""
        });
      }

      const finalRelievers = [...relievers];
      while (finalRelievers.length < 7) {
        finalRelievers.push({
          name: `Relief Pitcher ${finalRelievers.length + 1}`,
          pd: "d4",
          handedness: "R",
          bt: 12,
          obt: 18,
          traits: ""
        });
      }

      setRoster({
        positionPlayers: [...lineup, ...finalBench],
        startingPitchers: finalStarters,
        reliefPitchers: finalRelievers
      });
    } catch (error) {
      console.error("Error generating roster:", error);
      alert("Error generating roster: " + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateCSV = () => {
    try {
      // Create CSV content
      let csvContent = "data:text/csv;charset=utf-8,";
      
      // Add Team name
      csvContent += `${teamName || 'Team'} Roster\n\n`;
      
      // Add Lineup section
      csvContent += "LINEUP\n";
      csvContent += "Player Name,POS,L/R,BT,OBT,Traits\n";
      
      roster.positionPlayers.slice(0, 8).forEach(player => {
        csvContent += `${player.name},${player.position},${player.handedness},${player.bt},${player.obt},${player.traits}\n`;
      });
      
      csvContent += "\nBENCH\n";
      csvContent += "Player Name,POS,L/R,BT,OBT,Traits\n";
      
      roster.positionPlayers.slice(8).forEach(player => {
        csvContent += `${player.name},${player.position},${player.handedness},${player.bt},${player.obt},${player.traits}\n`;
      });
      
      csvContent += "\nSTARTING PITCHERS\n";
      csvContent += "Player Name,P.D.,L/R,BT,OBT,Traits\n";
      
      roster.startingPitchers.forEach(player => {
        csvContent += `${player.name},${player.pd},${player.handedness},${player.bt},${player.obt},${player.traits}\n`;
      });
      
      csvContent += "\nRELIEF PITCHERS\n";
      csvContent += "Player Name,P.D.,L/R,BT,OBT,Traits\n";
      
      roster.reliefPitchers.forEach(player => {
        csvContent += `${player.name},${player.pd},${player.handedness},${player.bt},${player.obt},${player.traits}\n`;
      });
      
      // Create an invisible link and trigger download
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${teamName || 'Team'}_roster.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error generating CSV:", error);
      alert("Error generating CSV: " + error.message);
    }
  };

  const generateTXT = () => {
    try {
      // Create text content with fixed width columns for better alignment
      let textContent = `${teamName || 'Team'} ROSTER\n\n`;
      
      // Add Lineup section
      textContent += "LINEUP\n";
      textContent += "Player Name                POS  L/R  BT  OBT  Traits\n";
      textContent += "------------------------   ---  ---  --  ---  -------------\n";
      
      roster.positionPlayers.slice(0, 8).forEach(player => {
        textContent += `${player.name.padEnd(25)} ${player.position.padEnd(5)} ${player.handedness.padEnd(4)} ${String(player.bt).padEnd(4)} ${String(player.obt).padEnd(5)} ${player.traits}\n`;
      });
      
      textContent += "\nBENCH\n";
      textContent += "Player Name                POS  L/R  BT  OBT  Traits\n";
      textContent += "------------------------   ---  ---  --  ---  -------------\n";
      
      roster.positionPlayers.slice(8).forEach(player => {
        textContent += `${player.name.padEnd(25)} ${player.position.padEnd(5)} ${player.handedness.padEnd(4)} ${String(player.bt).padEnd(4)} ${String(player.obt).padEnd(5)} ${player.traits}\n`;
      });
      
      textContent += "\nSTARTING PITCHERS\n";
      textContent += "Player Name                P.D.    L/R  BT  OBT  Traits\n";
      textContent += "------------------------   -----   ---  --  ---  -------------\n";
      
      roster.startingPitchers.forEach(player => {
        textContent += `${player.name.padEnd(25)} ${player.pd.padEnd(8)} ${player.handedness.padEnd(4)} ${String(player.bt).padEnd(4)} ${String(player.obt).padEnd(5)} ${player.traits}\n`;
      });
      
      textContent += "\nRELIEF PITCHERS\n";
      textContent += "Player Name                P.D.    L/R  BT  OBT  Traits\n";
      textContent += "------------------------   -----   ---  --  ---  -------------\n";
      
      roster.reliefPitchers.forEach(player => {
        textContent += `${player.name.padEnd(25)} ${player.pd.padEnd(8)} ${player.handedness.padEnd(4)} ${String(player.bt).padEnd(4)} ${String(player.obt).padEnd(5)} ${player.traits}\n`;
      });
      
      // Create an invisible link and trigger download
      const blob = new Blob([textContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${teamName || 'Team'}_roster.txt`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error generating TXT:", error);
      alert("Error generating TXT: " + error.message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="print:hidden my-8">
        <h1 className="text-3xl font-bold mb-4">Deadball Roster Generator</h1>
        
        <div className="mb-4">
          <label className="block mb-2">Team Name:</label>
          <input 
            type="text" 
            value={teamName} 
            onChange={(e) => setTeamName(e.target.value)} 
            className="border p-2 rounded w-full max-w-md"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold mb-2">Upload Batting Stats</h2>
            <input 
              type="file" 
              accept=".csv,.txt" 
              onChange={handleBattingUpload} 
              className="border p-2 w-full"
            />
            {battingStats && <p>{battingStats.length} batting records loaded</p>}
          </div>
          
          <div>
            <h2 className="text-xl font-bold mb-2">Upload Pitching Stats</h2>
            <input 
              type="file" 
              accept=".csv,.txt" 
              onChange={handlePitchingUpload} 
              className="border p-2 w-full"
            />
            {pitchingStats && <p>{pitchingStats.length} pitching records loaded</p>}
          </div>
        </div>
        
        <button 
          onClick={generateRoster}
          disabled={!battingStats || !pitchingStats || isGenerating}
          className="bg-blue-500 text-white py-2 px-4 rounded mr-2 disabled:bg-gray-400"
        >
          Generate Roster
        </button>
        
        <button 
          onClick={handlePrint}
          disabled={!roster.positionPlayers.length}
          className="bg-purple-500 text-white py-2 px-4 rounded mr-2 disabled:bg-gray-400"
        >
          Print Roster
        </button>
      </div>
      
      {roster.positionPlayers.length > 0 && (
        <div className="roster-sheet p-4 border rounded print:border-0">
          <h1 className="text-2xl font-bold text-center mb-6 print:text-3xl">{teamName || 'Team'} Roster</h1>
          
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-2 border-b-2 border-black">Lineup</h2>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Player Name</th>
                  <th className="text-left py-2">POS</th>
                  <th className="text-left py-2">L/R</th>
                  <th className="text-left py-2">BT</th>
                  <th className="text-left py-2">OBT</th>
                  <th className="text-left py-2">Traits</th>
                </tr>
              </thead>
              <tbody>
                {roster.positionPlayers.slice(0, 8).map((player, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-1">{player.name}</td>
                    <td className="py-1">{player.position}</td>
                    <td className="py-1">{player.handedness}</td>
                    <td className="py-1">{player.bt}</td>
                    <td className="py-1">{player.obt}</td>
                    <td className="py-1">{player.traits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-2 border-b-2 border-black">Bench</h2>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Player Name</th>
                  <th className="text-left py-2">POS</th>
                  <th className="text-left py-2">L/R</th>
                  <th className="text-left py-2">BT</th>
                  <th className="text-left py-2">OBT</th>
                  <th className="text-left py-2">Traits</th>
                </tr>
              </thead>
              <tbody>
                {roster.positionPlayers.slice(8).map((player, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-1">{player.name}</td>
                    <td className="py-1">{player.position}</td>
                    <td className="py-1">{player.handedness}</td>
                    <td className="py-1">{player.bt}</td>
                    <td className="py-1">{player.obt}</td>
                    <td className="py-1">{player.traits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-2 border-b-2 border-black">Starting Pitchers</h2>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Player Name</th>
                  <th className="text-left py-2">P.D.</th>
                  <th className="text-left py-2">L/R</th>
                  <th className="text-left py-2">BT</th>
                  <th className="text-left py-2">OBT</th>
                  <th className="text-left py-2">Traits</th>
                </tr>
              </thead>
              <tbody>
                {roster.startingPitchers.map((player, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-1">{player.name}</td>
                    <td className="py-1">{player.pd}</td>
                    <td className="py-1">{player.handedness}</td>
                    <td className="py-1">{player.bt}</td>
                    <td className="py-1">{player.obt}</td>
                    <td className="py-1">{player.traits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div>
            <h2 className="text-xl font-bold mb-2 border-b-2 border-black">Relief Pitchers</h2>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Player Name</th>
                  <th className="text-left py-2">P.D.</th>
                  <th className="text-left py-2">L/R</th>
                  <th className="text-left py-2">BT</th>
                  <th className="text-left py-2">OBT</th>
                  <th className="text-left py-2">Traits</th>
                </tr>
              </thead>
              <tbody>
                {roster.reliefPitchers.map((player, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-1">{player.name}</td>
                    <td className="py-1">{player.pd}</td>
                    <td className="py-1">{player.handedness}</td>
                    <td className="py-1">{player.bt}</td>
                    <td className="py-1">{player.obt}</td>
                    <td className="py-1">{player.traits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      <style jsx global>{`
        @media print {
          body {
            font-size: 12pt;
          }
          .roster-sheet {
            page-break-after: always;
          }
        }
      `}</style>
    </div>
  );
}