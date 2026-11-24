"use client";

import { useId, useRef } from "react";

export default function MobileHelp({ label, className, heading, as: HeadingGroup = "div", children }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  const trigger = (
    <button
      type="button"
      className="mobile-help"
      aria-label={label}
      aria-haspopup="dialog"
      onClick={() => dialogRef.current.showModal()}
    >
      <span aria-hidden="true">?</span>
    </button>
  );

  return (
    <>
      <HeadingGroup className="mobile-help-heading">
        {heading}
        {trigger}
      </HeadingGroup>
      <div className="mobile-help-desktop">
        <p className={className}>{children}</p>
      </div>
      <dialog
        ref={dialogRef}
        className="mobile-help-dialog"
        aria-labelledby={titleId}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className="mobile-help-content">
          <h2 id={titleId}>{label}</h2>
          <p>{children}</p>
          <button type="button" className="pill-outline" onClick={() => dialogRef.current.close()}>Fechar</button>
        </div>
      </dialog>
    </>
  );
}
