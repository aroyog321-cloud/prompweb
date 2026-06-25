export function createOpenAIStream(response: Response) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let accumulatedText = "";
  let buffer = "";
  
  const transformStream = new TransformStream({
    async transform(chunk, controller) {
      const text = decoder.decode(chunk, { stream: true });
      buffer += text;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? "";
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6);
          if (dataStr === '[DONE]') continue;
          
          try {
            const data = JSON.parse(dataStr);
            if (data.error) {
              const errorChunk = {
                choices: [{
                  delta: { content: `\n[API Error: ${data.error.message || 'Unknown error during stream'}]` }
                }]
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
              continue;
            }
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
              const content = data.candidates[0].content.parts[0].text;
              accumulatedText += content;
              const openAIChunk = {
                choices: [{
                  delta: { content }
                }]
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(openAIChunk)}\n\n`));
            }
          } catch (e) {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    },
    async flush() {
      // Stream is complete
    }
  });

  const readable = response.body?.pipeThrough(transformStream);
  return readable ? new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  }) : new Response("Failed to start stream", { status: 500 });
}
