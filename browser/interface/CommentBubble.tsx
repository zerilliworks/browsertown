interface Props {
  author: string;
  timestamp: string;
  avatarUrl: string;
  color: "red" | "green" | "grey" | "blue" | "yellow" | "indigo";
  children: any;
}

export default function CommentBubble(props: Props) {
  return (
    <div className={`absolute w-64 p-2 m-4 mt-12 flex flex-col rounded shadow bg-${props.color}-dark text-white`}>
      <img src={props.avatarUrl} alt="Avatar"
           className="rounded-full w-16 h-16 -mt-12 self-center border-2 border-white shadow"/>
      <p className={"m-2"}>{props.children}</p>
      <div className="rounded-full px-2 -mb-4 text-black text-center bg-grey-lighter border-2 border-white shadow">{props.timestamp} by {props.author}</div>
    </div>
  )
}
