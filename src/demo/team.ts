// Tres Hornos Bakery's Ocean Beach cafe, the week the homepage follows: two bakers at
// $22.00 and fourteen baristas and counter staff at $19.00, plus the three teammates
// from North Park and Barrio Logan that Saturday's 6:12 am call-out is measured against.
// Hours follow the page's records: bakers 8/8/8/8/16/16/16, baristas and counter
// 46/44/46/49/62/90.5/76, Jess 30.0, Tomas 32.0 (with Saturday's pickup), Dev 24.0, Grace 34.0.

/** [day (0 = Monday), start, end, unpaid meal minutes, position label, cafe?] */
export type Shift=[number,string,string,number,string,string?]
export type Member={name:string;role:'staff'|'manager';position:string|null;rate:number|null;site:string|null;shifts:Shift[];alsoAvailable?:number[];saturday?:[string,string]}

export const OCEAN_BEACH='Ocean Beach'
const BAKERS='Bakers',BARISTAS='Baristas and counter'
const baker=(days:number[]):Shift[]=>days.map(d=>[d,'06:00','14:30',30,'Baker'])
const shifts=(...list:[number,string,string,number?,string?][]):Shift[]=>list.map(([d,a,b,meal,label])=>[d,a,b,meal??30,label??'Barista'])
const ob=(name:string,list:Shift[],extra:Partial<Member>={}):Member=>({name,role:'staff',position:BARISTAS,rate:1900,site:OCEAN_BEACH,shifts:list,...extra})

export const team:Member[]=[
 {name:'Kim Tran',role:'manager',position:BAKERS,rate:2200,site:OCEAN_BEACH,shifts:baker([0,1,4,5,6])},
 {name:'Rafael Ortiz',role:'staff',position:BAKERS,rate:2200,site:OCEAN_BEACH,shifts:baker([2,3,4,5,6])},
 ob('Jess Morales',shifts([1,'07:00','15:00'],[3,'07:00','15:00'],[4,'07:00','15:00'],[5,'07:00','15:00'])),
 ob('Tomas Silva',shifts([0,'09:00','13:00',0,'Counter'],[1,'09:00','13:00',0,'Counter'],[2,'09:00','13:00',0,'Counter'],[3,'09:00','13:00',0,'Counter'],[4,'09:00','13:00',0,'Counter'],[5,'09:00','13:00',0],[6,'08:00','16:30',30,'Counter'])),
 ob('Dev Shah',shifts([0,'10:00','18:30',30,'Counter'],[2,'10:00','18:30'],[4,'10:00','18:30',30,'Counter']),{alsoAvailable:[5]}),
 ob('Grace Lee',shifts([1,'07:00','15:00'],[2,'07:00','15:00'],[3,'07:00','15:00'],[5,'07:00','15:00'],[6,'10:00','14:00',0])),
 ob('Bianca Flores',shifts([0,'07:00','15:00'],[3,'08:00','16:00',30,'Counter'],[5,'08:00','16:00'],[6,'07:00','15:00'])),
 ob('Marco Diaz',shifts([0,'10:00','18:00',30,'Counter'],[3,'10:00','18:00'],[5,'07:00','15:00',30,'Counter'],[6,'09:00','17:00'])),
 ob('Sofia Ramirez',shifts([0,'08:00','16:00'],[4,'07:00','15:00'],[5,'09:00','17:00'],[6,'08:00','16:00',30,'Counter'])),
 ob('Hannah Park',shifts([0,'11:00','19:00',30,'Counter'],[4,'10:00','18:00'],[5,'10:00','18:00',30,'Counter'],[6,'10:00','18:00'])),
 ob('Isaac Torres',shifts([3,'07:00','15:00',30,'Counter'],[4,'08:00','16:00'],[5,'10:00','18:00'],[6,'11:00','19:00',30,'Counter'])),
 ob('Maya Patel',shifts([0,'11:00','15:00',0],[2,'07:00','15:00',30,'Counter'],[4,'14:00','19:00',0,'Counter'],[5,'07:00','15:00'],[6,'07:00','15:00'])),
 ob('Noah Garcia',shifts([1,'09:00','15:30'],[2,'10:00','18:00'],[5,'08:00','16:00',30,'Counter'],[6,'09:00','17:00',30,'Counter'])),
 ob('Priya Desai',shifts([1,'15:00','19:00',0,'Counter'],[2,'11:00','19:00'],[5,'10:00','18:00'],[6,'11:00','19:00'])),
 ob('Elena Castillo',shifts([1,'07:00','15:00',30,'Counter'],[2,'15:00','19:00',0],[4,'11:00','19:00'],[5,'09:00','17:00',30,'Counter'],[6,'15:00','19:00',0])),
 ob('Owen Mitchell',shifts([1,'10:00','18:00'],[3,'11:00','19:00',30,'Counter'],[4,'07:00','15:00'],[5,'15:00','19:00',0,'Counter']),{saturday:['14:00','21:00']}),
 {name:'Luis Ortega',role:'staff',position:BARISTAS,rate:1900,site:'North Park',shifts:[0,1,2,3].map(d=>[d,'06:30','14:30',30,'Barista','North Park'] as Shift),alsoAvailable:[5]},
 {name:'Marisol Peña',role:'staff',position:BARISTAS,rate:1900,site:'Barrio Logan',shifts:[...[1,2,3].map(d=>[d,'07:00','15:00',30,'Barista','Barrio Logan'] as Shift),[6,'08:00','15:00',30,'Barista','Barrio Logan']],alsoAvailable:[5]},
 {name:'Andrea Cruz',role:'staff',position:BARISTAS,rate:1900,site:'Barrio Logan',shifts:[...[0,1,2,3].map(d=>[d,'07:00','15:00',30,'Barista','Barrio Logan'] as Shift),[4,'09:00','15:30',30,'Barista','Barrio Logan']],alsoAvailable:[5]},
]
/** Ocean Beach's sales forecast (Mon–Sun) after Thursday's Saturday change, and its labor budget. */
export const forecast={days:[4400,4200,4400,4700,6400,8900,7400],budgetPercent:25}
export const email=(name:string)=>`${name.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,'.')}@treshornos.example`
