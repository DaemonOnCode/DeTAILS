export interface Tag {
    tag: string;
    size: string;
    updated: string;
}

export interface MainModel {
    name: string;
    description: string;
}

export interface Metadata {
    main_model: MainModel;
    tags: Tag[];
}

export interface ModelObj {
    name: string;
    digest?: string;
}
