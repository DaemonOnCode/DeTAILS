from datetime import datetime
import json
from uuid import UUID
from langchain.callbacks.base import BaseCallbackHandler
from langchain.schema import Document, LLMResult
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple, Type, Union

class Color:
    PURPLE = "\033[95m"
    CYAN = "\033[96m"
    DARKCYAN = "\033[36m"
    BLUE = "\033[94m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    BOLD = "\033[1m"
    UNDERLINE = "\033[4m"
    ITALICS = "\x1B[3m"
    END = "\033[0m\x1B[0m"

class OutputFormatter:
    @staticmethod
    def heading(text: str) -> None:
        print(f"{Color.BOLD}{text}{Color.END}")

    @staticmethod
    def key_info(text: str) -> None:
        print(f"{Color.BOLD}{Color.DARKCYAN}{text}{Color.END}")

    @staticmethod
    def key_info_labeled(label: str, contents: str, contents_newlined: Optional[bool] = False) -> None:
        print(f"{Color.BOLD}{Color.DARKCYAN}{label}: {Color.END}{Color.DARKCYAN}", end="")
        if contents_newlined:
            contents = "\n".join(contents.splitlines())
        print(f"{contents}")
        print(f"{Color.END}", end="")

    @staticmethod
    def debug_info(text: str) -> None:
        print(f"{Color.BLUE}{text}{Color.END}")

    @staticmethod
    def debug_info_labeled(label: str, contents: str, contents_newlined: Optional[bool] = False) -> None:
        print(f"{Color.BOLD}{Color.BLUE}{label}: {Color.END}{Color.BLUE}", end="")
        if contents_newlined:
            contents = "\n".join(contents.splitlines())
        print(f"{contents}")
        print(f"{Color.END}", end="")

    @staticmethod
    def llm_call(text: str) -> None:
        print(f"{Color.ITALICS}{text}{Color.END}")

    @staticmethod
    def llm_output(text: str) -> None:
        print(f"{Color.UNDERLINE}{text}{Color.END}")

    @staticmethod
    def tool_call(text: str) -> None:
        print(f"{Color.ITALICS}{Color.PURPLE}{text}{Color.END}")

    @staticmethod
    def tool_output(text: str) -> None:
        print(f"{Color.UNDERLINE}{Color.PURPLE}{text}{Color.END}")

    @staticmethod
    def debug_error(text: str) -> None:
        print(f"{Color.BOLD}{Color.RED}{text}{Color.END}")

class AllChainDetails(BaseCallbackHandler):
    def __init__(self, debug_mode: Optional[bool] = False, out: Type[OutputFormatter] = OutputFormatter, log_file: str = 'chain_log.jsonl', log_to_file: bool = True) -> None:
        """Initialize the callback handler with logging options."""
        self.debug_mode = debug_mode
        self.out = out
        self.log_file = log_file
        self.log_to_file = log_to_file

    def _log_event(self, event_type: str, details: Dict[str, Any], run_id: Optional[UUID] = None, parent_run_id: Optional[UUID] = None) -> None:
        """Log an event to the file in JSON Lines format if logging is enabled."""
        if not self.log_to_file:
            return
        event = {
            "run_id": str(run_id) if run_id else "Unknown",
            "parent_run_id": str(parent_run_id) if parent_run_id else None,
            "event_type": event_type,
            "timestamp": datetime.now().isoformat(),
            "details": details
        }
        with open(self.log_file, 'a') as f:
            f.write(json.dumps(event) + '\n')

    def on_text(self, text: str, color: Optional[str] = None, end: str = "", **kwargs: Any) -> None:
        run_id = kwargs.get('run_id')
        parent_run_id = kwargs.get('parent_run_id')
        details = {"text": text, "color": color, "end": end}
        self._log_event("on_text", details, run_id, parent_run_id)
        self.out.heading(f"\n\n> Preparing text.")
        print(text)

    def on_llm_new_token(self, token: Any, *, chunk: Any = None, run_id: UUID, parent_run_id: Optional[UUID] = None, **kwargs: Any) -> Any:
        details = {"token": str(token), "chunk": str(chunk) if chunk else None}
        self._log_event("on_llm_new_token", details, run_id, parent_run_id)
        self.out.heading(f"\n\n> New token.")
        self.out.key_info_labeled("Chain ID", f"{run_id}")
        self.out.key_info_labeled("Parent chain ID", f"{parent_run_id}")
        self.out.key_info_labeled("Token", f"{token}")

    def on_llm_start(self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any) -> None:
        run_id = kwargs.get('run_id')
        parent_run_id = kwargs.get('parent_run_id')
        details = {"prompts": prompts}
        self._log_event("on_llm_start", details, run_id, parent_run_id)
        self.out.heading(f"\n\n> Sending text to the LLM.")
        self.out.key_info_labeled("Prompt", prompts[0])

    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        run_id = kwargs.get('run_id')
        parent_run_id = kwargs.get('parent_run_id')
        generated_text = response.generations[0][0].text if response.generations else "No generations"
        details = {"generated_text": generated_text}
        self._log_event("on_llm_end", details, run_id, parent_run_id)
        self.out.heading(f"\n\n> Received response from LLM.")
        self.out.key_info_labeled("Generated Text", generated_text)

    def on_chain_start(self, serialized: Dict[str, Any], inputs: Dict[str, Any], **kwargs: Any) -> None:
        run_id = kwargs.get('run_id')
        parent_run_id = kwargs.get('parent_run_id')
        class_name = ".".join(serialized['id']) if 'id' in serialized else "Unknown -- serialized['id'] is missing"
        inputs_filtered = {k: v for k, v in inputs.items() if k not in ["stop", "agent_scratchpad"]}
        details = {"class_name": class_name, "inputs": inputs_filtered}
        self._log_event("on_chain_start", details, run_id, parent_run_id)
        self.out.heading(f"\n\n> Starting new chain.")
        if 'id' not in serialized.keys():
            self.out.debug_error("Missing serialized['id']")
        self.out.key_info_labeled("Chain class", f"{class_name}")
        self.out.key_info_labeled("Chain ID", f"{run_id}")
        self.out.key_info_labeled("Parent chain ID", f"{parent_run_id}")
        if not inputs_filtered:
            self.out.debug_error("Chain inputs is empty.")
        else:
            self.out.key_info("Iterating through keys/values of chain inputs:")
            for key, value in inputs_filtered.items():
                self.out.key_info_labeled(f"   {key}", f"{value}")

    def on_chain_end(self, outputs: Dict[str, Any], **kwargs: Any) -> None:
        run_id = kwargs.get('run_id')
        parent_run_id = kwargs.get('parent_run_id')
        details = {"outputs": outputs}
        self._log_event("on_chain_end", details, run_id, parent_run_id)
        self.out.heading(f"\n\n> Ending chain.")
        self.out.key_info_labeled("Chain ID", f"{run_id}")
        self.out.key_info_labeled("Parent chain ID", f"{parent_run_id}")
        if not outputs:
            self.out.debug_error("No chain outputs.")
        else:
            for key, value in outputs.items():
                self.out.key_info_labeled(f"Output {key}", f"{value}", contents_newlined=True)

    def on_llm_error(self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any) -> None:
        run_id = kwargs.get('run_id')
        parent_run_id = kwargs.get('parent_run_id')
        details = {"error": str(error)}
        self._log_event("on_llm_error", details, run_id, parent_run_id)
        self.out.debug_error(f"LLM Error: {error}")

    def on_chain_error(self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any) -> None:
        run_id = kwargs.get('run_id')
        parent_run_id = kwargs.get('parent_run_id')
        details = {"error": str(error)}
        self._log_event("on_chain_error", details, run_id, parent_run_id)
        self.out.debug_error(f"Chain Error: {error}")

    def on_tool_error(self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any) -> None:
        run_id = kwargs.get('run_id')
        parent_run_id = kwargs.get('parent_run_id')
        details = {"error": str(error)}
        self._log_event("on_tool_error", details, run_id, parent_run_id)
        self.out.debug_error(f"Tool Error: {error}")

    def on_retriever_start(self, serialized: Dict[str, Any], query: str, *, run_id: UUID, parent_run_id: Optional[UUID] = None, tags: Optional[List[str]] = None, metadata: Optional[Dict[str, Any]] = None, **kwargs: Any) -> Any:
        class_name = ".".join(serialized['id']) if 'id' in serialized else "Unknown -- serialized['id'] is missing"
        details = {"class_name": class_name, "query": query, "tags": tags, "metadata": metadata}
        self._log_event("on_retriever_start", details, run_id, parent_run_id)
        self.out.heading(f"\n\n> Querying retriever.")
        self.out.key_info_labeled("Chain ID", f"{run_id}")
        self.out.key_info_labeled("Parent chain ID", f"{parent_run_id}")
        self.out.key_info_labeled("Tags", f"{tags}")
        if 'id' not in serialized.keys():
            self.out.debug_error("Missing serialized['id']")
        self.out.key_info_labeled("Retriever class", f"{class_name}")
        self.out.key_info("Query sent to retriever:")
        self.out.tool_call(query)

    def on_retriever_end(self, documents: Sequence[Document], *, run_id: UUID, parent_run_id: Optional[UUID] = None, **kwargs: Any) -> Any:
        details = {
            "num_documents": len(documents),
            "documents": [{"metadata": doc.metadata, "page_content": doc.page_content} for doc in documents]
        }
        self._log_event("on_retriever_end", details, run_id, parent_run_id)
        self.out.heading(f"\n\n> Retriever finished.")
        self.out.key_info_labeled("Chain ID", f"{run_id}")
        self.out.key_info_labeled("Parent chain ID", f"{parent_run_id}")
        self.out.key_info(f"Found {len(documents)} documents.")
        if len(documents) == 0:
            self.out.debug_error("No documents found.")
        else:
            for doc_num, doc in enumerate(documents):
                self.out.key_info("---------------------------------------------------")
                self.out.key_info(f"Document number {doc_num} of {len(documents)}")
                self.out.key_info_labeled("Metadata", f"{doc.metadata}")
                self.out.key_info("Document contents:")
                self.out.tool_output(doc.page_content)