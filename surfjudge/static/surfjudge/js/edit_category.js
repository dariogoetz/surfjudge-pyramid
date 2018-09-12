/* =========================================================
 * heat.js
 * =========================================================
 * Copyright 2018 Dario Goetz
 * ========================================================= */

(function($, undefined){
    $.widget('surfjudge.edit_category', {
        options: {
            category_id: null,
            tournament_id: null,
            data: null,
        },

        _create: function(){
            this.data = this.options.data || {};

            if (!this._check_inputs()){
                console.log('Inputs of edit_category module not valid.');
                return;
            }

            this._init_html();

            this._register_events();
            if (this.options.category_id !== null)
                this._initialized = this.refresh();
            else
                this._initialized = $.Deferred().resolve().promise();
        },

        _destroy: function(){
            this.element.empty();
        },

        _check_inputs: function(){
            if (this.options.category_id === null
                && this.options.tournament_id === null)
                // new category, but tournament unspecified
                return false;
            return true;
        },

        _init_html: function(){
            var _this = this;
            html = [
                '<div class="alert dirty_marker">',
                '    <div class="form-group row">',
                '        <label class="col-2 control-label">Category Name</label>',
                '        <div class="col-10">',
                '            <input type="hidden" class="category_input" data-key="id">',
                '            <input type="text" name="name" class="form-control category_input" data-key="name" placeholder="Category Name">',
                '        </div>',
                '    </div>',
                '    <div class="form-group row">',
                '        <label class="col-sm-2 control-label">Additional Info</label>',
                '        <div class="col-sm-10">',
                '            <input type="text" name="modal_additional_info" class="form-control category_input" data-key="additional_info" placeholder="Additional Info">',
                '        </div>',
                '    </div>',
                '    <button type="button" class="btn btn-danger delete_btn">Delete</button>',
                '    <div class="float-right">',
                '        <button type="button" class="btn btn-light reset_btn">Reset</button>',
                '        <button type="button" class="btn btn-primary save_changes_btn">Save changes</button>',
                '    </div>',
                '</div>',
            ].join(' ');

            this.element.append(html);
        },

        _register_events: function(){
            this._on(this.element, {
                'click .reset_btn': this.refresh,
                'click .delete_btn': this.delete_category,
                'click .save_changes_btn': this.upload,
                'change': this._mark_dirty,
            });
        },

        refresh: function(){
            console.log('refreshing');
            var _this = this;
            var deferred = $.Deferred();
            var query = {}
            if (this.options.category_id !== null){
                query['category_ids'] = [this.options.category_id];
                $.getJSON('/tournament_admin/do_get_categories', {category_ids: this.options.category_id})
                    .done(function(categories){
                        if (categories.length > 0){
                            _this.data = categories[0];
                            _this._refresh();
                            _this._mark_clean();
                        } else {
                            console.log('Category not found.');
                            _this.options.category_id = null;
                            _this._mark_clean();
                            deferred.reject();
                        }
                    })
                    .fail(function(){
                        console.log('Connection error.');
                        deferred.reject();
                    });
            } else {
                //this._refresh();
                console.log('Nothing to refresh (no category id specified)');
                _this._mark_clean();
                deferred.resolve();
            }

            return deferred.promise();
        },

        _refresh: function(){
            var _this = this;

            this.element.find('.category_input').each(function(idx, elem){
                var key = $(this).data('key');
                $(this).val(_this.data[key]);
            });
        },

        upload: function(){
            var _this = this;
            this._fetch_details_from_inputs();
            if (!this._check_data()){
                console.log('Upload failed due to data check');
                return;
            }
            if (this.options.category_id === null){
                this.data['tournament_id'] = this.options.tournament_id;
            }

            var deferred = $.Deferred();
            $.post('/tournament_admin/do_edit_category', this.data, function(ev_data){
                _this.options.category_id = parseInt(ev_data);
                _this.refresh();
                _this._trigger('data_changed', null);
                deferred.resolve();
            });
            return deferred.promise();
        },

        delete_category: function(){
            var _this = this;
            var deferred = $.Deferred();
            if (this.options.category_id !== null) {
                $.post('/tournament_admin/do_delete_category', {id: this.options.category_id})
                    .done(function(){
                        console.log("deleted category " + _this.options.category_id);
                        // initialize module as empty
                        _this.options.tournament_id = _this.options.tournament_id || _this.data['tournament_id'];
                        _this.options.category_id = null;
                        _this.data = {};
                        _this._refresh();
                        _this._trigger('deleted');
                        _this._trigger('data_changed');
                        deferred.resolve();
                    })
                    .fail(function(){
                        console.log('Connection error.');
                        deferred.reject();
                    });
            } else {
                console.log('No category id specified.');
                deferred.reject();
            }
            return deferred.promise();
        },

        get_data: function(){
            this._fetch_details_from_inputs();
            console.log(this.data);
            return $.extend({}, this.data);
        },

        get_category_id: function(){
            return this.options.category_id;
        },

        _fetch_details_from_inputs: function(){
            var _this = this;
            this.element.find('.category_input').each(function(idx, elem){
                _this.data[$(this).data('key')] = $(this).val();
            });
        },

        _check_data: function(){
            if (this.data['name'].length == 0) {
                alert('Empty field "Category Name"');
                return false;
            }
            return true;
        },

        _mark_dirty: function(){
            this.element.find('.dirty_marker').addClass('alert-danger');
        },

        _mark_clean: function(){
            this.element.find('.dirty_marker').removeClass('alert-danger');
        },
    });
}(jQuery));
