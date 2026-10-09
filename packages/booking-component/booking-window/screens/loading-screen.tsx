// Booking component: the window while its first answer is on the way (10 seconds at most).

export type LoadingScreenPropsType = { titleId: string };

export function LoadingScreen({ titleId }: LoadingScreenPropsType) {
  return (
    <>
      <div className="sa-head">
        <h2 className="sa-title" id={titleId} tabIndex={-1}>
          Book online
        </h2>
      </div>
      <div className="sa-body">
        <p className="sa-loading" role="status">
          Loading…
        </p>
      </div>
    </>
  );
}
