export function CareButton({ className = '', ...props }) {
    return <button className={`care-control ${className}`} {...props} />;
}

export function CareInput({ className = '', type, ...props }) {
    return <input type={type} className={['checkbox', 'radio', 'hidden'].includes(type) ? className : `ui-input care-field ${className}`} {...props} />;
}

export function CareSelect({ className = '', ...props }) {
    return <select className={`ui-input care-field ${className}`} {...props} />;
}

export function CareTextarea({ className = '', ...props }) {
    return <textarea className={`ui-input care-field ${className}`} {...props} />;
}
