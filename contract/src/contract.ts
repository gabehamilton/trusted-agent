// Find all our documentation at https://docs.near.org
import { NearBindgen, NearPromise, near, call, view, Vector, assert} from 'near-sdk-js';
import { AccountId } from 'near-sdk-js/lib/types'

@NearBindgen({})
class FlightPurchase {
  // avector: Vector<string> = new Vector<string>('unique-id-vector1');
  purchaseHistory: string = "history";
  // flightPurchase: string="";

  @view({}) // This method is read-only and can be called for free
  get_flights(): string {
    return this.purchaseHistory;
  }
  
  @call({})
  purchase_flight({ to, flight_text }: { to: AccountId, flight_text: string }) {
    const flightInfo = `${flight_text}`;
    near.log(flightInfo)
    this.purchaseHistory += flightInfo
  }

  // purchase_flight({ to, origin, destination, amount }: { to: AccountId, origin: string, destination: string, amount: bigint }) {
  //   NearPromise.new(to).transfer(amount);
  //   const flightInfo = ` from ${origin} to ${destination} for amount ${amount.toString()}.`;
  //   near.log(flightInfo)
  //   this.purchaseHistory += flightInfo
  // }
  
  // @call({})
  // record_flight({ to, origin, destination, amount }: { to: AccountId, origin: string, destination: string, amount: bigint }) {
  // const flightInfo = `${to} from ${origin} to ${destination} for amount ${amount.toString()}`;
  // this.avector.push(flightInfo);
  // assert(this.avector.length == 1, "Incorrect length")
  // }
}