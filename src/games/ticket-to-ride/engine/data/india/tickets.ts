import type { Ticket } from '../../types';

type Def = [a: string, b: string, points: number];

/**
 * The 52 destination tickets of the India map. A ticket is
 * worth the number of trains on the shortest way between its two cities.
 */
const TICKETS: Def[] = [
  ['i-ahmedabad', 'i-goa', 5],
  ['i-hyderabad', 'i-kochi', 5],
  ['i-kathmandu', 'i-dhaka', 5],
  ['i-lahore', 'i-jaipur', 5],
  ['i-shimla', 'i-indore', 5],
  ['i-srinagar', 'i-jodhpur', 5],
  ['i-varanasi', 'i-kolkata', 5],
  ['i-mangaluru', 'i-colombo', 6],
  ['i-siliguri', 'i-bhubaneswar', 6],
  ['i-agra', 'i-mumbai', 7],
  ['i-bhopal', 'i-bengaluru', 7],
  ['i-nagpur', 'i-madurai', 7],
  ['i-patna', 'i-vizag', 7],
  ['i-raipur', 'i-chennai', 7],
  ['i-delhi', 'i-patna', 8],
  ['i-delhi', 'i-raipur', 8],
  ['i-goa', 'i-colombo', 8],
  ['i-imphal', 'i-ranchi', 8],
  ['i-karachi', 'i-pune', 8],
  ['i-varanasi', 'i-guwahati', 8],
  ['i-agra', 'i-vizag', 9],
  ['i-kathmandu', 'i-dibrugarh', 9],
  ['i-kolkata', 'i-chennai', 9],
  ['i-lahore', 'i-pune', 9],
  ['i-shimla', 'i-hyderabad', 9],
  ['i-indore', 'i-kochi', 10],
  ['i-jaipur', 'i-bengaluru', 10],
  ['i-lucknow', 'i-chittagong', 10],
  ['i-siliguri', 'i-bhopal', 10],
  ['i-ahmedabad', 'i-ranchi', 11],
  ['i-chittagong', 'i-nagpur', 11],
  ['i-bhubaneswar', 'i-mumbai', 12],
  ['i-dibrugarh', 'i-vizag', 12],
  ['i-karachi', 'i-lucknow', 12],
  ['i-srinagar', 'i-ranchi', 12],
  ['i-guwahati', 'i-bhopal', 13],
  ['i-imphal', 'i-nagpur', 13],
  ['i-jaipur', 'i-dhaka', 13],
  ['i-jodhpur', 'i-madurai', 13],
  ['i-shimla', 'i-mangaluru', 13],
  ['i-imphal', 'i-hyderabad', 14],
  ['i-srinagar', 'i-bhubaneswar', 14],
  ['i-guwahati', 'i-bengaluru', 15],
  ['i-kathmandu', 'i-mangaluru', 15],
  ['i-lucknow', 'i-colombo', 15],
  ['i-siliguri', 'i-madurai', 15],
  ['i-delhi', 'i-dibrugarh', 16],
  ['i-guwahati', 'i-mumbai', 18],
  ['i-ahmedabad', 'i-imphal', 19],
  ['i-karachi', 'i-kolkata', 19],
  ['i-dibrugarh', 'i-kochi', 20],
  ['i-karachi', 'i-chittagong', 22],
];

export const INDIA_TICKETS: Ticket[] = TICKETS.map(([a, b, points], i) => ({ id: `i-t${i + 1}`, a, b, points }));
