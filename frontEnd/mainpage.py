import os
import requests
import streamlit as st


def get_api_base_url() -> str:
    default = "http://127.0.0.1:8000"
    return os.environ.get("GATORGUIDE_API_URL", default)


def get_default_timeout() -> int:
    try:
        return int(os.environ.get("GATORGUIDE_API_TIMEOUT", "120"))
    except ValueError:
        return 120


def init_state():
    if "messages" not in st.session_state:
        st.session_state.messages = [
            {
                "role": "assistant",
                "content": "Hi! I'm your Education Advisor. Ask about colleges, programs, locations, or acceptance rates.",
            }
        ]
    if "api_base" not in st.session_state:
        st.session_state.api_base = get_api_base_url()
    if "timeout_s" not in st.session_state:
        st.session_state.timeout_s = get_default_timeout()


def render_sidebar():
    with st.sidebar:
        st.header("Settings")
        st.session_state.api_base = st.text_input(
            "API base URL",
            value=st.session_state.api_base,
            help="FastAPI endpoint base. Default: http://127.0.0.1:8000",
        )
        st.session_state.timeout_s = st.number_input(
            "Request timeout (seconds)",
            min_value=5,
            max_value=600,
            value=int(st.session_state.timeout_s),
            step=5,
            help="Increase if the advisor takes longer to respond.",
        )
        st.caption(
            "Messages are sent to the /advisor endpoint as student_input."
        )


def render_chat_messages():
    for m in st.session_state.messages:
        with st.chat_message(m["role"]):
            st.write(m["content"]) 
            if m.get("schools"):
                st.markdown("**🎓 Suggested Schools**")
                for s in m["schools"]:
                    name = s.get('name', 'Unknown')
                    city = s.get('city', '')
                    state = s.get('state', '')
                    acceptance = s.get('acceptance_rate')
                    tuition_in = s.get('tuition_in_state')
                    tuition_out = s.get('tuition_out_of_state')
                    weather = s.get('weather')
                    
                    # School header
                    st.markdown(f"##### {name}")
                    st.caption(f"📍 {city}, {state}")
                    
                    # Create columns for organized display
                    col1, col2 = st.columns(2)
                    
                    with col1:
                        if acceptance is not None:
                            # Handle both decimal (0.39) and percentage (39) formats
                            rate = acceptance if acceptance > 1 else acceptance * 100
                            st.metric("Acceptance Rate", f"{rate:.1f}%")
                        if tuition_in is not None:
                            st.metric("In-State Tuition", f"${tuition_in:,.0f}/yr")
                    
                    with col2:
                        if tuition_out is not None:
                            st.metric("Out-of-State Tuition", f"${tuition_out:,.0f}/yr")
                        if weather:
                            temp = weather.get('temperature_celsius')
                            if temp is not None:
                                st.metric("Current Weather", f"{temp}°C")
                    
                    st.divider()


def call_advisor_api(api_base: str, user_text: str, timeout_s: int):
    url = f"{api_base.rstrip('/')}/advisor"
    try:
        # Separate connect/read timeouts: 10s connect, configurable read
        resp = requests.post(
            url,
            json={"student_input": user_text},
            timeout=(10, max(1, int(timeout_s))),
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            "response": data.get("response", ""),
            "schools": data.get("schools", []) or [],
            "error": None,
        }
    except requests.exceptions.ReadTimeout as e:
        return {
            "response": "",
            "schools": [],
            "error": f"Read timeout after {timeout_s}s. Try increasing the timeout.",
        }
    except requests.exceptions.RequestException as e:
        return {"response": "", "schools": [], "error": str(e)}


def main():
    st.set_page_config(page_title="GatorGuide Advisor", page_icon="🎓")
    st.title("GatorGuide — Education Advisor 🎓")
    st.caption("Chat to explore colleges and get tailored suggestions.")

    init_state()
    render_sidebar()
    render_chat_messages()

    user_input = st.chat_input("Ask about colleges, programs, or locations…")
    if user_input:
        st.session_state.messages.append({"role": "user", "content": user_input})
        with st.chat_message("user"):
            st.write(user_input)

        with st.chat_message("assistant"):
            with st.spinner("Thinking…"):
                result = call_advisor_api(
                    st.session_state.api_base, user_input, st.session_state.timeout_s
                )
            if result["error"]:
                st.error(f"API error: {result['error']}")
                content = "Sorry, I couldn't reach the advisor API."
                assistant_msg = {"role": "assistant", "content": content}
                st.session_state.messages.append(assistant_msg)
                st.write(content)
            else:
                content = result["response"] or "I couldn't understand the query. Try rephrasing?"
                assistant_msg = {
                    "role": "assistant",
                    "content": content,
                    "schools": result.get("schools", []),
                }
                st.session_state.messages.append(assistant_msg)
                st.write(content)
                if assistant_msg.get("schools"):
                    st.markdown("**🎓 Suggested Schools**")
                    for s in assistant_msg["schools"]:
                        name = s.get('name', 'Unknown')
                        city = s.get('city', '')
                        state = s.get('state', '')
                        acceptance = s.get('acceptance_rate')
                        tuition_in = s.get('tuition_in_state')
                        tuition_out = s.get('tuition_out_of_state')
                        weather = s.get('weather')
                        
                        # School header
                        st.markdown(f"##### {name}")
                        st.caption(f"📍 {city}, {state}")
                        
                        # Create columns for organized display
                        col1, col2 = st.columns(2)
                        
                        with col1:
                            if acceptance is not None:
                                # Handle both decimal (0.39) and percentage (39) formats
                                rate = acceptance if acceptance > 1 else acceptance * 100
                                st.metric("Acceptance Rate", f"{rate:.1f}%")
                            if tuition_in is not None:
                                st.metric("In-State Tuition", f"${tuition_in:,.0f}/yr")
                        
                        with col2:
                            if tuition_out is not None:
                                st.metric("Out-of-State Tuition", f"${tuition_out:,.0f}/yr")
                            if weather:
                                temp = weather.get('temperature_celsius')
                                if temp is not None:
                                    st.metric("Current Weather", f"{temp}°C")
                        
                        st.divider()


if __name__ == "__main__":
    main()

