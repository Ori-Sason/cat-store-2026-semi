export interface PickupPoint {
  id: string
  name: string
  address: string
  hours: string
  lng: number
  lat: number
}

export const PICKUP_POINTS: PickupPoint[] = [
  {
    id: 'tel-aviv',
    name: 'Tel Aviv',
    address: 'Dizengoff St 120, Tel Aviv',
    hours: 'Sun–Thu 10:00–19:00 · Fri 09:00–14:00',
    lng: 34.774,
    lat: 32.0809,
  },
  {
    id: 'jerusalem',
    name: 'Jerusalem',
    address: 'First Station, David Remez St 4, Jerusalem',
    hours: 'Sun–Thu 09:00–18:00 · Fri 09:00–13:00',
    lng: 35.2248,
    lat: 31.7663,
  },
  {
    id: 'haifa',
    name: 'Haifa',
    address: 'Herzl St 30, Hadar, Haifa',
    hours: 'Sun–Thu 10:00–18:00 · Fri 09:00–13:00',
    lng: 34.9984,
    lat: 32.8106,
  },
  {
    id: 'beer-sheva',
    name: "Be'er Sheva",
    address: "Keren Kayemet St 50, Old City, Be'er Sheva",
    hours: 'Sun–Thu 09:00–17:00',
    lng: 34.7915,
    lat: 31.2381,
  },
  {
    id: 'eilat',
    name: 'Eilat',
    address: 'HaTmarim Blvd 10, Eilat',
    hours: 'Sun–Thu 10:00–20:00 · Fri 09:00–14:00 · Sat 18:00–21:00',
    lng: 34.9507,
    lat: 29.5616,
  },
]
