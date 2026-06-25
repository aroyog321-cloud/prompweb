type QueuePayload = Record<string, any>;

export const enqueueJob = async (queueName: string, payload: QueuePayload) => {
  const provider = process.env.QUEUE_PROVIDER || 'memory';
  
  if (provider === 'memory') {
    console.log(`[Queue: Memory] Enqueued to ${queueName}:`, payload);
    // Simulate async processing
    setTimeout(() => {
      console.log(`[Queue: Memory] Processed ${queueName} job.`);
    }, 100);
  } else {
    // throw new Error('Unsupported queue provider')
    console.log(`[Queue: ${provider}] Enqueued to ${queueName}:`, payload);
  }
};
