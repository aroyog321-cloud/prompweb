const { Readable } = require('stream');

(async () => {
  const payload = {
    text: "design a learning pathway for a complete beginner to learn coding in 3 months",
    mode: "auto",
    level: "Staff+",
    style: "neutral",
    stream: true
  };

  try {
    const res = await fetch('http://localhost:3000/api/optimize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log("Status:", res.status);
    if (!res.ok) {
      console.log("Error:", await res.text());
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') continue;
          try {
            const data = JSON.parse(dataStr);
            const content = data.choices?.[0]?.delta?.content || "";
            text += content;
            process.stdout.write(content);
          } catch(e) {}
        }
      }
    }

    console.log("\n\n--- Finished ---");
    console.log("Total words:", text.split(/\s+/).filter(Boolean).length);
  } catch (e) {
    console.error("Test failed:", e);
  }
})();
