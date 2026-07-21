import { supabase } from '../db.js';

export const EventEngine = {
  async publish(eventType, publisher, payload) {
    const event = {
      event_type: eventType,
      publisher,
      payload,
    };

    console.log(`📡 [EVENT] ${eventType} published by ${publisher}`);

    const { data, error } = await supabase
      .from('system_events')
      .insert([event])
      .select();

    if (error) {
      console.error('❌ Failed to log system event to DB:', error.message);
    }
    
    return data?.[0];
  }
};