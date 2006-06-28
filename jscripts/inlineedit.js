var inlineEditor = Class.create();

inlineEditor.prototype = {
	initialize: function(url, options)
	{
		this.url = url;
		this.elements = new Array();
		this.currentIndex = -1;
		this.options = options;
		if(!options.className && !options.textBox)
		{
			alert('You need to specify either a className or textBox in the options.');
			return false;
		}
		if(options.spinnerImage)
		{
			this.spinnerImage = options.spinnerImage;
		}
		if(options.editButton == true)
		{
			this.editButton = true;
		}
		if(options.textBox)
		{
			if(!$(options.textBox))
			{
				return false;
			}
			this.elements[0] = $(options.textBox);
			this.makeEditable($(options.textBox));
		}
		else
		{
			this.elements = DomLib.getElementsByClassName(document, "*", options.className);
			if(this.elements)
			{
				for(var i = 0; i < this.elements.length; i++)
				{
					this.elements[i].index = i;
					this.makeEditable(this.elements[i]);
				}
			}
		}
	},

	makeEditable: function(element)
	{
		if(!this.editButton)
		{
			if(element.title != "")
			{
				element.title = element.title+" ";
			}
			element.title = element.title+"(Click and hold to edit)";
			element.onmousedown = this.onMouseDown.bindAsEventListener(this);
		}
		else
		{
			editButton = $(element.id+"_inlineedit");
			if(editButton)
			{
				editButton.onclick = function() {this.onButtonClick(element.id)}.bind(this);
			}
		}
	},

	onMouseDown: function(e)
	{
		var element = Event.element(e);
		Event.stop(e);
		// Fix for konqueror which likes to set event element as the text not the link
		if(typeof(element.index) == "undefined" && typeof(element.parentNode.index) != "undefined")
		{
			element.index = element.parentNode.index;
		}
		this.currentIndex = element.index;
		this.timeout = setTimeout(this.showTextbox.bind(this), 1200);
		element.onmouseup = this.onMouseUp.bindAsEventListener(this);
		return false;
	},
	
	onMouseUp: function(e)
	{
		clearTimeout(this.timeout);
		Event.stop(e);	
		return false;
	},

	onButtonClick: function(id)
	{
		if($(id))
		{
			this.currentIndex = $(id).index;
			this.showTextbox();
		}
		return false;
	},
	
	showTextbox: function()
	{
		this.element = this.elements[this.currentIndex];
		if(typeof(this.element.parentNode) == "undefined" || typeof(this.element.index) == "undefined")
		{
			return false;
		}
		this.currentIndex = this.element.index;
		this.oldValue = this.element.innerHTML;
		this.parentNode = this.element.parentNode;
		if(!this.parentNode)
		{
			alert(this.element.index);
			alert('no parent node');
		}
		this.cache = this.parentNode.innerHTML;
		
		this.textbox = document.createElement("input");
		this.textbox.style.width = "95%";
		this.textbox.maxlength="85";
		this.textbox.className = "textbox";
		this.textbox.type = "text";
		Event.observe(this.textbox, "blur", this.onBlur.bindAsEventListener(this));
		Event.observe(this.textbox, "keyup", this.onKeyUp.bindAsEventListener(this));
		this.textbox.setAttribute("autocomplete", "off");
		this.textbox.name = "value";
		this.textbox.index = this.element.index;
		this.textbox.value = MyBB.unHTMLchars(this.oldValue);
		
		Element.remove(this.element);
		this.parentNode.innerHTML = '';
		this.parentNode.appendChild(this.textbox);
		this.textbox.focus();
	},

	onBlur: function(e)
	{
		this.hideTextbox();
	},

	onKeyUp: function(e)
	{
		if((e.keyCode == Event.KEY_RETURN || e.keyCode == Event.KEY_ESC))
		{
			this.hideTextbox();
		}
	},

	onSubmit: function(e)
	{
		this.hideTextbox();
	},

	hideTextbox: function()
	{
		Event.stopObserving(this.textbox, "blur", this.onBlur.bindAsEventListener(this));
		var newValue = this.textbox.value;
		if(typeof(newValue) != "undefined" && newValue != '' && MyBB.HTMLchars(newValue) != this.oldValue)
		{
			this.parentNode.innerHTML = this.cache;
			this.element = DomLib.getElementsByClassName(this.parentNode, "*", this.options.className)[0];
			this.element.innerHTML = newValue;
			this.element.index = this.currentIndex;
			this.element.onmousedown = this.onMouseDown.bindAsEventListener(this);
			this.elements[this.element.index] = this.element;
			this.lastIndex = this.currentIndex;
			postData = "value="+encodeURIComponent(newValue)
			if(this.spinnerImage)
			{
				this.showSpinner();
			}
			if(this.element.id)
			{
				idInfo = this.element.id.split("_");
				if(idInfo[0] && idInfo[1])
				{
					postData = postData+"&"+idInfo[0]+"="+idInfo[1];
				}
			}
			new ajax(this.url, {method: 'post', postBody: postData, onComplete: this.onComplete.bind(this)});
		}
		else
		{
			Element.remove(this.textbox);
			this.parentNode.innerHTML = this.cache;
 			this.element = DomLib.getElementsByClassName(this.parentNode, "*", this.options.className)[0];
			this.element.index = this.currentIndex;
			this.elements[this.element.index] = this.element;
			this.element.onmousedown = this.onMouseDown.bindAsEventListener(this);
		}
		this.currentIndex = -1;
	},

	onComplete: function(request)
	{
		if(request.responseText.match(/<error>(.*)<\/error>/))
		{
			message = request.responseText.match(/<error>(.*)<\/error>/);
			this.element.innerHTML = this.oldValue;
			if(!message[1])
			{
				message[1] = "An unknown error occurred.";
			}
			alert('There was an error performing the update.\n\n'+message[1]);
		}
		else if(request.responseText)
		{
			this.element.innerHTML = MyBB.HTMLchars(request.responseText);
		}
		if(this.spinnerImage)
		{
			this.hideSpinner();
		}
	},

	showSpinner: function()
	{
		if(!this.spinnerImage)
		{
			return false;
		}
		if(!this.spinner)
		{
			this.spinner = document.createElement("img");
			this.spinner.src = this.spinnerImage;
			this.spinner.alt = "Saving changes.."
			this.spinner.style.verticalAlign = "middle";
			this.spinner.style.paddingRight = "3px";
		}
		this.parentNode.insertBefore(this.spinner, this.parentNode.firstChild);
	},

	hideSpinner: function()
	{
		if(!this.spinnerImage)
		{
			return false;
		}
		Element.remove(this.spinner);
	}
}